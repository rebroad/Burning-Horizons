#!/usr/bin/env python3
"""Private terminal worker. stdin/stdout are strict NDJSON, never diagnostic logs."""
import base64,collections,fcntl,json,os,pathlib,pty,select,signal,struct,subprocess,sys,tempfile,time,uuid
TOOLS=pathlib.Path(__file__).resolve().parent
CLAUDE=pathlib.Path.home()/'.local/share/fred-ai/runtime/claude-2.1.318/node_modules'
MAX_LINE=8192

def message(kind,**fields):return (json.dumps({'type':kind,**fields},separators=(',',':'))+'\n').encode()
def dimensions(value):
    if type(value) is not int or not 20<=value<=300:raise ValueError('dimensions')
    return value

def sandbox_command(socket_path,provider,scope,probe=None):
    args=['/usr/bin/systemd-run','--user','--scope','--quiet','--unit='+scope,'-p','CPUQuota=50%','-p','MemoryMax=1536M','-p','MemorySwapMax=0','-p','TasksMax=128','--','/usr/bin/bwrap','--unshare-all','--die-with-parent','--new-session','--cap-drop','ALL','--clearenv','--ro-bind','/usr','/usr','--symlink','usr/bin','/bin','--symlink','usr/sbin','/sbin','--symlink','usr/lib','/lib','--symlink','usr/lib64','/lib64','--proc','/proc','--dev','/dev','--dir','/etc','--dir','/etc/ssl','--dir','/etc/ssl/certs','--ro-bind','/etc/ssl/certs/ca-certificates.crt','/etc/ssl/certs/ca-certificates.crt','--dir','/run','--ro-bind',str(socket_path),'/run/fred-proxy.sock','--dir','/home','--size',str(128*1024*1024),'--tmpfs',('' + ('' + '/' + 'home/fred' + '') + ''),'--size',str(256*1024*1024),'--tmpfs','/workspace','--size',str(128*1024*1024),'--tmpfs','/tmp','--dir','/opt','--dir','/opt/fred-ai','--ro-bind',str(TOOLS/'ai-terminal-inner.py'),'/opt/fred-ai/ai-terminal-inner.py','--chdir','/workspace']
    if provider=='claude':args+=['--ro-bind',str(CLAUDE),'/opt/claude-runtime']
    env={'HOME':('' + ('' + '/' + 'home/fred' + '') + ''),'CODEX_HOME':('' + ('' + '/' + 'home/fred' + '') + '/.codex'),'CLAUDE_CONFIG_DIR':('' + ('' + '/' + 'home/fred' + '') + '/.claude'),'PATH':'/usr/bin:/bin','TERM':'xterm-256color','LANG':'C.UTF-8','TMPDIR':'/tmp','HTTPS_PROXY':'http://127.0.0.1:18080','HTTP_PROXY':'http://127.0.0.1:18080','https_proxy':'http://127.0.0.1:18080','http_proxy':'http://127.0.0.1:18080','NO_PROXY':'','NODE_USE_ENV_PROXY':'1','DISABLE_AUTOUPDATER':'1','CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC':'1'}
    for name,value in env.items():args+=['--setenv',name,value]
    if probe:args+=['--ro-bind',str(probe),'/opt/fred-ai/probe.py']
    args+=['--remount-ro','/','--remount-ro','/dev']
    if probe:args+=['/usr/bin/python3','/opt/fred-ai/probe.py']
    else:args+=['/usr/bin/python3','/opt/fred-ai/ai-terminal-inner.py',provider]
    return args

def scope_empty(scope):
    try:
        result=subprocess.run(['/usr/bin/systemctl','--user','show',scope+'.scope','-p','LoadState','-p','ActiveState','-p','ControlGroup'],stdout=subprocess.PIPE,stderr=subprocess.DEVNULL,text=True,timeout=1)
        values=dict(line.split('=',1) for line in result.stdout.splitlines() if '=' in line)
        if values.get('LoadState')=='not-found' and values.get('ActiveState')=='inactive':return True
        group=values.get('ControlGroup','')
        if values.get('ActiveState') not in ('inactive','failed'):return False
        if group:
            path=pathlib.Path('/sys/fs/cgroup')/group.lstrip('/')
            if path.exists() and (path/'cgroup.procs').read_text().strip():return False
        return bool(values)
    except (OSError,subprocess.TimeoutExpired):return False

def cleanup_scope(scope):
    for action in (['kill','--kill-whom=all','--signal=SIGKILL'],['stop']):
        try:subprocess.run(['/usr/bin/systemctl','--user',*action,scope+'.scope'],stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL,timeout=1)
        except (OSError,subprocess.TimeoutExpired):pass
    empty=scope_empty(scope)
    if empty:
        # A killed launcher can leave only a failed-unit tombstone. Unload this
        # verified-empty private unit so admission diagnostics see no residue.
        try:subprocess.run(['/usr/bin/systemctl','--user','reset-failed',scope+'.scope'],stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL,timeout=1)
        except (OSError,subprocess.TimeoutExpired):pass
    return empty and scope_empty(scope)

def lifecycle_phase(_name):
    # Trusted qualification may replace this callback; no wire/config hook exists.
    pass

def main():
    interrupted=False
    def on_signal(_signum,_frame):
        nonlocal interrupted
        interrupted=True
    for signum in (signal.SIGHUP,signal.SIGTERM,signal.SIGINT):signal.signal(signum,on_signal)
    watchdog=None;master=slave=None;scope='fred-ai-'+uuid.uuid4().hex
    queue=collections.deque();queued=0;buffer=b'';control_buffer=b'';input_pending=bytearray()
    started=False;pending=False;stopping=False;done=False;exit_code=0;clean=False;exit_sent=False
    deadline=time.monotonic()+1800
    def emit(kind,**fields):
        nonlocal queued
        data=message(kind,**fields);queue.append(data);queued+=len(data)
    def request_stop():
        nonlocal stopping,done,clean
        if stopping:return
        stopping=True
        if watchdog is None:done=True;clean=True
        else:
            try:watchdog.stdin.write(b'stop\n');watchdog.stdin.flush()
            except (OSError,BrokenPipeError):pass
    os.set_blocking(0,False);os.set_blocking(1,False)
    try:
        while not done:
            if interrupted:request_stop()
            if time.monotonic()>deadline:raise ValueError('lifetime')
            if queued>512*1024:raise ValueError('backpressure')
            readers=([0] if not stopping else [])+([master] if master is not None and not stopping else [])+([watchdog.stdout] if watchdog is not None else [])
            writers=([1] if queue else [])+([master] if master is not None and input_pending and not stopping else [])
            ready,writable,_=select.select(readers,writers,[],.1)
            if master is not None and master in writable:
                try:del input_pending[:os.write(master,input_pending)]
                except BlockingIOError:pass
            if 1 in writable:
                try:
                    sent=os.write(1,queue[0]);queued-=sent
                    if sent==len(queue[0]):queue.popleft()
                    else:queue[0]=queue[0][sent:]
                except BlockingIOError:pass
            if 0 in ready:
                chunk=os.read(0,4096)
                if not chunk:request_stop()
                else:
                    buffer+=chunk
                    if len(buffer)>MAX_LINE:raise ValueError('input_limit')
                    while b'\n' in buffer and not stopping:
                        line,buffer=buffer.split(b'\n',1);data=json.loads(line)
                        if type(data) is not dict or type(data.get('type')) is not str:raise ValueError('protocol')
                        kind=data['type']
                        if kind=='start' and not started and not pending and set(data)=={'type','provider','cols','rows'}:
                            provider=data['provider'];cols=dimensions(data['cols']);rows=dimensions(data['rows'])
                            if provider not in ('codex','claude'):raise ValueError('provider')
                            if provider=='claude' and not CLAUDE.is_dir():raise ValueError('runtime_unavailable')
                            root=pathlib.Path.home()/'.local/share/fred-ai/sessions'
                            session_path=root/('session-'+uuid.uuid4().hex)
                            master,slave=pty.openpty();fcntl.ioctl(slave,0x5414,struct.pack('HHHH',rows,cols,0,0));os.set_blocking(master,False)
                            lifecycle_phase('before-watchdog')
                            watchdog=subprocess.Popen(['/usr/bin/python3',str(TOOLS/'ai-terminal-watchdog.py'),scope,str(session_path),provider,str(slave)],stdin=subprocess.PIPE,stdout=subprocess.PIPE,stderr=subprocess.DEVNULL,start_new_session=True,pass_fds=(slave,))
                            lifecycle_phase('after-watchdog')
                            os.close(slave);slave=None;pending=True
                        elif kind=='input' and started and set(data)=={'type','data'}:
                            if type(data['data']) is not str or len(data['data'])>5500:raise ValueError('input_limit')
                            payload=base64.b64decode(data['data'],validate=True)
                            if len(payload)>4096:raise ValueError('input_limit')
                            input_pending.extend(payload)
                            if len(input_pending)>32768:raise ValueError('input_limit')
                        elif kind=='resize' and started and set(data)=={'type','cols','rows'}:
                            cols=dimensions(data['cols']);rows=dimensions(data['rows']);fcntl.ioctl(master,0x5414,struct.pack('HHHH',rows,cols,0,0))
                        elif kind=='stop' and set(data)=={'type'}:request_stop()
                        else:raise ValueError('protocol')
            if master is not None and master in ready:
                try:
                    payload=os.read(master,8192)
                    if payload:emit('output',data=base64.b64encode(payload).decode('ascii'))
                except OSError:pass
            if watchdog is not None and watchdog.stdout in ready:
                chunk=os.read(watchdog.stdout.fileno(),4096)
                if not chunk:raise ValueError('supervisor_lost')
                control_buffer+=chunk
                if len(control_buffer)>8192:raise ValueError('supervisor_lost')
                while b'\n' in control_buffer:
                    line,control_buffer=control_buffer.split(b'\n',1);event=json.loads(line)
                    if event.get('type')=='ready':started=True;emit('ready',provider=provider,cols=cols,rows=rows)
                    elif event.get('type')=='exit':emit('exit',code=event['code']);exit_sent=True;stopping=True
                    elif event.get('type')=='ended':clean=event.get('clean') is True;done=True
                    elif event.get('type')=='error':emit('error',code='worker_failed');exit_code=1
                    else:raise ValueError('supervisor_lost')
            if watchdog is not None and watchdog.poll() is not None and not done:raise ValueError('supervisor_lost')
    except (ValueError,TypeError,KeyError,OSError,subprocess.SubprocessError) as error:
        exit_code=1
        queue.clear();queued=0
        emit('error',code=str(error) if isinstance(error,ValueError) and str(error) in ('protocol','dimensions','provider','runtime_unavailable','input_limit','lifetime','backpressure','supervisor_lost') else 'worker_failed')
    finally:
        if watchdog is not None:
            try:watchdog.stdin.close()
            except OSError:pass
            end=time.monotonic()+9
            while not done and time.monotonic()<end:
                if not select.select([watchdog.stdout],[],[],.1)[0]:continue
                chunk=os.read(watchdog.stdout.fileno(),4096)
                if not chunk:break
                control_buffer+=chunk
                while b'\n' in control_buffer:
                    line,control_buffer=control_buffer.split(b'\n',1)
                    try:event=json.loads(line)
                    except ValueError:continue
                    if event.get('type')=='exit' and not exit_sent:emit('exit',code=event.get('code',1));exit_sent=True
                    if event.get('type')=='ended':clean=event.get('clean') is True;done=True
            if clean:
                try:watchdog.wait(timeout=1)
                except subprocess.TimeoutExpired:clean=False
                if watchdog.returncode!=0:clean=False
        else:clean=True
        for descriptor in (master,slave):
            if descriptor is not None:
                try:os.close(descriptor)
                except OSError:pass
        emit('ended',clean=clean)
        if not clean:exit_code=1
        flush_until=time.monotonic()+1
        while queue and time.monotonic()<flush_until:
            if not select.select([],[1],[],.1)[1]:continue
            try:
                sent=os.write(1,queue[0]);queue[0]=queue[0][sent:]
                if not queue[0]:queue.popleft()
            except OSError:exit_code=1;break
        if queue:exit_code=1
    return exit_code
if __name__=='__main__':sys.exit(main())
