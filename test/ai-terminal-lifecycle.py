#!/usr/bin/env python3
"""Linux integration qualification. Uses fresh tmpfs probes, never provider auth."""
import base64,importlib.util,json,os,pathlib,select,shutil,signal,subprocess,sys,tempfile,time,unittest
TOOLS=pathlib.Path(sys.argv[1]).resolve() if len(sys.argv)>1 else pathlib.Path(__file__).resolve().parents[1]/'tools'
if len(sys.argv)>1:sys.argv=[sys.argv[0],*sys.argv[2:]]
QUAL=pathlib.Path.home()/'.local/share/fred-ai/qualification'
QUAL.mkdir(parents=True,exist_ok=True)
REPORT=[]

def scopes():
    output=subprocess.run(['systemctl','--user','list-units','--all','--type=scope','--plain','--no-legend','--no-pager'],capture_output=True,text=True,timeout=2).stdout
    return {line.split()[0] for line in output.splitlines() if 'fred-ai-' in line}
def sessions():
    root=pathlib.Path.home()/'.local/share/fred-ai/sessions'
    return {p.name for p in root.iterdir()} if root.exists() else set()
def wait_until(predicate,timeout=10):
    end=time.monotonic()+timeout
    while time.monotonic()<end:
        if predicate():return True
        time.sleep(.05)
    return False

class Fixture:
    def __init__(self,phase=None,delay_cleanup=False):
        self.before_scopes=scopes();self.before_sessions=sessions();self.phase=phase
        self.directory=tempfile.TemporaryDirectory(prefix='lifecycle-',dir=QUAL);self.root=pathlib.Path(self.directory.name)
        self.gate=self.root/'release';self.marker=self.root/'phase.json';self.tools=self.root/'tools';self.tools.mkdir()
        self.probe=self.root/'probe.py';self.probe.write_text(("import pathlib,time\npathlib.Path('" + ('' + '/' + 'home/fred' + '') + "/credential-canary').write_text('qualification-only')\nprint('isolated probe ready',flush=True)\nwhile True:time.sleep(.1)\n"))
        self.delayed=self.root/'delayed-launcher.py'
        self.delayed.write_text('import json,os,pathlib,time\n'+f"pathlib.Path({str(self.marker)!r}).write_text(json.dumps({{'phase':'launcher-delay','pid':os.getpid()}}))\n"+f"while not pathlib.Path({str(self.gate)!r}).exists():time.sleep(.02)\n"+"os.execv('/usr/bin/systemd-run',"+repr([])+")\n")
        hook="""def phase_hook(name):
 if name=='after-watchdog':
  import inspect
  process=inspect.currentframe().f_back.f_locals.get('watchdog')
  if process:(MARKER.parent/'supervisor-pid').write_text(str(process.pid))
 if name==PHASE:
  MARKER.write_text(json.dumps({'phase':name,'pid':os.getpid()}))
  while not GATE.exists():time.sleep(.02)
"""
        common='import importlib.util,json,os,pathlib,time,sys\n'+f'PHASE={phase!r};MARKER=pathlib.Path({str(self.marker)!r});GATE=pathlib.Path({str(self.gate)!r})\n'+hook
        watcher=common+"(MARKER.parent/'supervisor-pid').write_text(str(os.getpid()))\n"+f"spec=importlib.util.spec_from_file_location('supervisor',{str(TOOLS/'ai-terminal-watchdog.py')!r});m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)\nm.lifecycle_phase=phase_hook\n"
        watcher+=f"original=m.worker.sandbox_command\nprobe=pathlib.Path({str(self.probe)!r})\n"
        watcher+="def command(socket,provider,scope):\n args=original(socket,provider,scope,probe)\n"
        if phase=='launcher-delay':
            watcher+=f" source='import json,os,pathlib,time\\n'+{('pathlib.Path('+repr(str(self.marker))+').write_text(json.dumps({"phase":"launcher-delay","pid":os.getpid()}))\n')!r}+{('while not pathlib.Path('+repr(str(self.gate))+').exists():time.sleep(.02)\n')!r}+'os.execv(\\'/usr/bin/systemd-run\\','+repr(args)+')\\n'\n pathlib.Path({str(self.delayed)!r}).write_text(source)\n return ['/usr/bin/python3',{str(self.delayed)!r}]\n"
        else:watcher+=' return args\n'
        watcher+='m.worker.sandbox_command=command\n'
        if delay_cleanup:
            watcher+=f"real_cleanup=m.worker.cleanup_scope\ndef held_cleanup(scope):\n result=real_cleanup(scope)\n return result and GATE.exists()\nm.worker.cleanup_scope=held_cleanup\n"
        watcher+='sys.exit(m.main())\n';(self.tools/'ai-terminal-watchdog.py').write_text(watcher)
        launcher=common+f"spec=importlib.util.spec_from_file_location('worker',{str(TOOLS/'ai-terminal-sandbox.py')!r});m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)\nm.lifecycle_phase=phase_hook\nm.TOOLS=pathlib.Path({str(self.tools)!r})\nsys.exit(m.main())\n"
        self.launcher=self.root/'worker.py';self.launcher.write_text(launcher)
        self.process=subprocess.Popen(['/usr/bin/python3',str(self.launcher)],stdin=subprocess.PIPE,stdout=subprocess.PIPE,stderr=subprocess.PIPE)
        self.buffer=b'';self.events=[];self.output=b'';self.safe_diagnostics={}
    def send(self,data):self.process.stdin.write((json.dumps(data)+'\n').encode());self.process.stdin.flush()
    def start(self):self.send({'type':'start','provider':'codex','cols':100,'rows':30})
    def read(self,timeout=.1):
        if not select.select([self.process.stdout],[],[],timeout)[0]:return []
        chunk=os.read(self.process.stdout.fileno(),16384)
        if not chunk:return []
        self.buffer+=chunk;events=[]
        while b'\n' in self.buffer:
            line,self.buffer=self.buffer.split(b'\n',1);event=json.loads(line);events.append(event);self.events.append(event)
            if event['type']=='output':self.output+=base64.b64decode(event['data'])
        return events
    def ready(self):
        until=time.monotonic()+10
        while time.monotonic()<until:
            self.read()
            self.safe_diagnostics={'types':[e['type'] for e in self.events],'errors':[e.get('code') for e in self.events if e['type']=='error'],'outputBytes':len(self.output),'joinedReady':b'isolated probe ready' in self.output,'perFrameReady':any(e['type']=='output' and b'isolated probe ready' in base64.b64decode(e['data']) for e in self.events),'failureMarkers':{word:word.encode() in self.output for word in ['Failed','Permission denied','timed out','Traceback','Read-only']}}
            if b'isolated probe ready' in self.output:return True
            if self.process.poll() is not None:return False
        return False
    def ended(self,timeout=12):
        until=time.monotonic()+timeout
        while time.monotonic()<until:
            for event in self.read():
                if event['type']=='ended':return event
            if self.process.poll() is not None:
                self.read();return next((e for e in self.events if e['type']=='ended'),None)
        return None
    def clean(self):return scopes()==self.before_scopes and sessions()==self.before_sessions
    def close(self):
        self.gate.touch()
        if self.process.poll() is None:
            try:self.send({'type':'stop'})
            except OSError:pass
        try:self.process.wait(timeout=12)
        except subprocess.TimeoutExpired:self.process.kill();self.process.wait()
        wait_until(self.clean)
        for stream in (self.process.stdin,self.process.stdout,self.process.stderr):
            if stream is not None and not stream.closed:stream.close()
        self.directory.cleanup()

class Lifecycle(unittest.TestCase):
    def test_stop_and_eof_ack_only_after_verified_cleanup(self):
        for mode in ['stop','eof']:
            with self.subTest(mode=mode):
                f=Fixture()
                try:
                    f.start();self.assertTrue(f.ready(),json.dumps(f.safe_diagnostics));self.assertFalse(f.clean())
                    if mode=='stop':f.send({'type':'stop'})
                    else:f.process.stdin.close()
                    ended=f.ended();self.assertEqual(ended,{'type':'ended','clean':True});self.assertTrue(f.clean())
                    self.assertEqual(f.process.wait(timeout=2),0)
                    types=[e['type'] for e in f.events];self.assertEqual(types[-1],'ended');self.assertLess(types.index('exit'),types.index('ended'))
                    self.assertEqual(f.process.stderr.read(),b'')
                    REPORT.append({'case':mode,'cleanAck':True,'sshExit':0,'resourcesAtAck':'gone'})
                finally:f.close()
    def test_startup_sigkill_all_phases_and_late_scope_registration(self):
        for phase in ['before-watchdog','after-watchdog','before-session','before-proxy','after-proxy','before-launcher','after-launcher','launcher-delay']:
            with self.subTest(phase=phase):
                f=Fixture(phase)
                try:
                    f.start();self.assertTrue(wait_until(f.marker.exists,10),'phase marker '+phase)
                    marker=json.loads(f.marker.read_text());f.process.kill();self.assertEqual(f.process.wait(timeout=2),-9)
                    # Let supervisors see EOF before releasing a paused startup.
                    if phase=='launcher-delay':
                        self.assertTrue(wait_until(lambda:not pathlib.Path('/proc/'+str(marker['pid'])).exists(),5),'delayed launcher killed before releasing registration gate')
                    f.gate.touch();self.assertTrue(wait_until(f.clean,10),'cleanup '+phase)
                    supervisor_file=f.root/'supervisor-pid'
                    if supervisor_file.exists():
                        supervisor_pid=supervisor_file.read_text()
                        def quiescent():
                            stat=pathlib.Path('/proc/'+supervisor_pid+'/stat')
                            try:return stat.read_text().split()[2]=='Z'
                            except FileNotFoundError:return True
                        self.assertTrue(wait_until(quiescent,5),'supervisor must finish before asserting no future launch')
                    time.sleep(.2);self.assertTrue(f.clean(),'no delayed registration '+phase)
                    f.read();self.assertFalse(any(e['type']=='ended' for e in f.events),'SIGKILL cannot acknowledge cleanup')
                    if phase=='launcher-delay':self.assertFalse(pathlib.Path('/proc/'+str(marker['pid'])).exists())
                    REPORT.append({'case':'SIGKILL','phase':phase,'remainingResources':0,'cleanupAck':False,'lateScopeAppeared':False})
                finally:f.close()
    def test_cleanup_failure_is_not_acknowledged_clean(self):
        f=Fixture(delay_cleanup=True)
        try:
            f.start();self.assertTrue(f.ready());f.send({'type':'stop'})
            ended=f.ended(12);self.assertEqual(ended,{'type':'ended','clean':False});self.assertEqual(f.process.wait(timeout=2),1)
            self.assertFalse(f.clean(),'session kept quarantined until verified')
            f.gate.touch();self.assertTrue(wait_until(f.clean,10))
            REPORT.append({'case':'cleanup-held','cleanAck':False,'sshExit':1,'quarantineReleasedOnlyAfterVerification':True})
        finally:f.close()
    def test_protocol_error_can_clean_but_keeps_nonzero_exit(self):
        f=Fixture()
        try:
            f.send({'type':'start','provider':'codex','cols':100,'rows':30,'command':'forbidden'})
            self.assertEqual(f.ended(),{'type':'ended','clean':True});self.assertEqual(f.process.wait(timeout=2),1);self.assertTrue(f.clean())
            REPORT.append({'case':'malformed-input','cleanAck':True,'sshExit':1})
        finally:f.close()

if __name__=='__main__':
    result=unittest.main(exit=False)
    print(json.dumps({'lifecycle':REPORT,'passed':result.result.wasSuccessful()},indent=2))
    sys.exit(0 if result.result.wasSuccessful() else 1)
