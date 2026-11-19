"""Private administrator-deployed, networkless SPARC serial worker.

Place beside a private worker-config.json. Browser requests may select only the
two declared system names; all executable/media paths come from this file.
"""
import base64,ctypes,io,json,os,queue,select,signal,socket,subprocess,sys,tempfile,threading,time
from pathlib import Path

ROOT=Path(__file__).resolve().parent
def emit(v):
 print(json.dumps(v),flush=True)
def run():
 config=json.loads((ROOT/'worker-config.json').read_text())
 first=json.loads(sys.stdin.readline(4097))
 if first.get('type')!='start' or first.get('system') not in ('netbsd','sunos'):raise ValueError('Invalid system')
 system=first['system']; guest=config['systems'].get(system)
 if not guest:raise ValueError('Guest not configured')
 # All values below are administrator-controlled. No browser path or flags.
 image=Path(guest['disk']).resolve(strict=True)
 if not image.is_file():raise ValueError('Invalid image')
 private=tempfile.TemporaryDirectory(prefix='fred-sun-');qmp_path=str(Path(private.name)/'qmp')
 args=[config['qemu'],'-M','SS-5','-m','128','-nographic','-serial','stdio','-monitor','none','-qmp',f'unix:{qmp_path},server=on,wait=off','-nic','none','-no-reboot','-drive',f'file={image},format={guest.get("format","raw")},snapshot=on']
 if guest.get('kernel'):args+=['-kernel',guest['kernel']]
 # A real pty and paced writes avoid the period Zilog driver's overrun on paste.
 import pty,tty
 master,slave=pty.openpty();tty.setraw(slave)
 parent=os.getpid()
 def contain():
  # Linux kills the emulator even if its worker is killed before cleanup runs.
  if ctypes.CDLL(None,use_errno=True).prctl(1,signal.SIGKILL,0,0,0)!=0 or os.getppid()!=parent:os._exit(126)
 child=subprocess.Popen(args,stdin=slave,stdout=slave,stderr=subprocess.DEVNULL,start_new_session=True,close_fds=True,preexec_fn=contain)
 os.close(slave);incoming=queue.Queue(maxsize=8192);ended=threading.Event();display=threading.Event()
 def reader():
  try:
   while True:
    line=sys.stdin.readline(8193)
    if not line or len(line)>8192:break
    v=json.loads(line)
    if v.get('type')=='end':break
    if v.get('type')=='display' and isinstance(v.get('enabled'),bool):
     (display.set if v['enabled'] else display.clear)();continue
    if v.get('type')!='input':raise ValueError('Invalid frame')
    data=base64.b64decode(v['data'],validate=True)
    if len(data)>3072:raise ValueError('Input too large')
    for byte in data:incoming.put_nowait(byte)
  except Exception:pass
  finally:ended.set()
 def finish(*_):ended.set()
 signal.signal(signal.SIGTERM,finish);signal.signal(signal.SIGHUP,finish)
 threading.Thread(target=reader,daemon=True).start();start=time.monotonic();sent=0;buffer=b'';bootstage=0;qmp=None;lastframe=0
 def qcommand(name,arguments=None):
  qmp.sendall((json.dumps({'execute':name,**({'arguments':arguments} if arguments else {})})+'\n').encode())
  while True:
   answer=json.loads(qfile.readline())
   if 'return' in answer:return answer['return']
   if 'error' in answer:raise ValueError('QMP operation failed')
 try:
  while not ended.is_set() and child.poll() is None and time.monotonic()-start<1800:
   if select.select([master],[],[],.01)[0]:
    try:data=os.read(master,16384)
    except OSError:break
    if not data:break
    emit({'type':'output','data':base64.b64encode(data).decode()});buffer=(buffer+data)[-8192:]
    # Root selection is necessary for direct ELF boot; never execute user code.
    stages=[(b'root device:',b'sd0a\r'),(b'dump device',b'none\r'),(b'file system',b'ffs\r')]
    if system=='netbsd' and bootstage<len(stages) and stages[bootstage][0] in buffer:
     for byte in stages[bootstage][1]:incoming.put_nowait(byte)
     bootstage+=1;buffer=b'';sent=time.monotonic()+.2
    if b'login:' in buffer and bootstage<6:
     emit({'type':'ready'});bootstage=6;buffer=b''
   now=time.monotonic()
   if display.is_set() and now-lastframe>=1:
    try:
     if qmp is None:
      qmp=socket.socket(socket.AF_UNIX);qmp.settimeout(2);qmp.connect(qmp_path);qfile=qmp.makefile('rb');json.loads(qfile.readline());qcommand('qmp_capabilities')
     ppm=Path(private.name)/'display.ppm';qcommand('screendump',{'filename':str(ppm)})
     from PIL import Image
     with Image.open(ppm) as frame:
      frame.thumbnail((1024,768));out=io.BytesIO();frame.convert('RGB').save(out,format='JPEG',quality=75)
      emit({'type':'frame','format':'jpeg','width':frame.width,'height':frame.height,'data':base64.b64encode(out.getvalue()).decode()})
     ppm.unlink(missing_ok=True)
    except Exception as error:
     print('Display capture: '+type(error).__name__+': '+str(error),file=sys.stderr,flush=True)
     if 'ppm' in locals():ppm.unlink(missing_ok=True)
     if qmp and 'qfile' in locals():qfile.close()
     if qmp:qmp.close()
     qmp=None
    lastframe=now
   if now-sent>=.08:
    try:byte=incoming.get_nowait()
    except queue.Empty:continue
    os.write(master,bytes([byte]));sent=now
 finally:
  try:os.killpg(child.pid,signal.SIGTERM)
  except ProcessLookupError:pass
  try:child.wait(timeout=2)
  except subprocess.TimeoutExpired:
   os.killpg(child.pid,signal.SIGKILL);child.wait()
  os.close(master)
  if qmp:qmp.close()
  private.cleanup();emit({'type':'exit','code':child.returncode})
if __name__=='__main__':
 try:run()
 except Exception:
  emit({'type':'error','message':'Private Sun guest unavailable'});sys.exit(1)
