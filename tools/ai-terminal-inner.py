#!/usr/bin/env python3
"""Runs only inside bwrap. Fixed provider launcher and bounded Unix proxy relay."""
import os,select,socket,subprocess,sys,threading
SLOTS=threading.BoundedSemaphore(16)
def relay(client):
    peer=None
    try:
        peer=socket.socket(socket.AF_UNIX);peer.settimeout(10);peer.connect('/run/fred-proxy.sock')
        client.settimeout(120);peer.settimeout(120)
        while True:
            ready,_,_=select.select([client,peer],[],[],120)
            if not ready:break
            for source in ready:
                data=source.recv(16384)
                if not data:return
                (peer if source is client else client).sendall(data)
    except OSError:pass
    finally:
        client.close()
        if peer:peer.close()
        SLOTS.release()
def accept(listener):
    while True:
        client,_=listener.accept()
        if not SLOTS.acquire(False):client.close();continue
        threading.Thread(target=relay,args=(client,),daemon=True).start()
def main():
    provider=sys.argv[1]
    if provider not in ('codex','claude'):return 2
    listener=socket.socket();listener.bind(('127.0.0.1',18080));listener.listen(16)
    threading.Thread(target=accept,args=(listener,),daemon=True).start()
    os.makedirs(('' + ('' + '/' + 'home/fred' + '') + '/.codex'),mode=0o700,exist_ok=True);os.makedirs(('' + ('' + '/' + 'home/fred' + '') + '/.claude'),mode=0o700,exist_ok=True)
    if provider=='codex':
        result=subprocess.run(['/usr/bin/codex','login','--device-auth'])
        if result.returncode:return result.returncode
        command=['/usr/bin/codex','--sandbox','workspace-write','--ask-for-approval','on-request','--cd','/workspace','--no-alt-screen']
    else:command=['/opt/claude-runtime/@anthropic-ai/claude-code/bin/claude.exe']
    # Keep the relay threads alive while the official CLI inherits this PTY.
    return subprocess.run(command).returncode
if __name__=='__main__':sys.exit(main())
