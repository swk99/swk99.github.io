"""Windows launcher for Worklog Lite. No Python installation required in the packaged app."""
import argparse
import json
import os
from pathlib import Path
import sys
import threading
import traceback
import webbrowser
import tkinter as tk
from tkinter import filedialog, messagebox
from server import Server, Wiki, restore_file, password_record, save_auth

VERSION='0.1.0'

def default_data_dir():
    base=Path(os.environ.get('LOCALAPPDATA',Path.home()/'.local'/'share'))
    return base/'WorklogLite'

class InstanceLock:
    def __init__(self,path):
        self.file=open(path,'a+b')
        self.file.seek(0,os.SEEK_END)
        if self.file.tell()==0:
            self.file.write(b'0');self.file.flush()
        self.file.seek(0)
        try:
            if os.name=='nt':
                import msvcrt
                msvcrt.locking(self.file.fileno(),msvcrt.LK_NBLCK,1)
            else:
                import fcntl
                fcntl.flock(self.file.fileno(),fcntl.LOCK_EX|fcntl.LOCK_NB)
        except OSError:
            self.file.close();raise RuntimeError('Worklog Lite is already running for this data folder. Open its existing window.')
    def close(self):
        self.file.close()

def start_desktop(data_dir):
    data_dir.mkdir(parents=True,exist_ok=True)
    lock=InstanceLock(data_dir/'application.lock')
    try:
        wiki=Wiki(data_dir/'worklog.sqlite3')
        try:
            server=Server(8766,wiki)
        except OSError:
            server=Server(0,wiki)
        thread=threading.Thread(target=server.serve_forever,daemon=True);thread.start()
        url=f'http://127.0.0.1:{server.server_address[1]}'
        root=tk.Tk();root.title('Worklog Lite');root.geometry('500x365');root.resizable(False,False);root.configure(bg='#f5f8fc')
        frame=tk.Frame(root,bg='#f5f8fc');frame.pack(fill='both',expand=True,padx=30,pady=25)
        tk.Label(frame,text='Worklog Lite',font=('Segoe UI',23,'bold'),fg='#172b4d',bg='#f5f8fc').pack(anchor='w')
        tk.Label(frame,text='Documents + tasks, on your computer.',font=('Segoe UI',11),fg='#66758b',bg='#f5f8fc').pack(anchor='w',pady=(4,18))
        tk.Label(frame,text='●  Running locally',font=('Segoe UI',11),fg='#216e4e',bg='#f5f8fc').pack(anchor='w')
        tk.Label(frame,text=url,font=('Segoe UI',11),fg='#172b4d',bg='#f5f8fc').pack(anchor='w',pady=(4,16))
        tk.Button(frame,text='Open workspace →',font=('Segoe UI',11,'bold'),bg='#0c66e4',fg='white',activebackground='#0055cc',activeforeground='white',bd=0,padx=16,pady=10,command=lambda:webbrowser.open(url)).pack(fill='x')
        actions=tk.Frame(frame,bg='#f5f8fc');actions.pack(fill='x',pady=12)
        def backup():
            path=filedialog.asksaveasfilename(parent=root,title='Save full workspace backup',defaultextension='.sqlite3',initialfile='worklog-lite-backup.sqlite3',filetypes=[('SQLite backup','*.sqlite3')])
            if not path:return
            if Path(path).resolve()==wiki.path.resolve():
                messagebox.showerror('Choose another file','Do not overwrite the live database.',parent=root);return
            try:
                Path(path).write_bytes(wiki.backup());messagebox.showinfo('Backup saved','Documents, issues, history and attachments were backed up. Login settings stay separate.',parent=root)
            except Exception as e:messagebox.showerror('Backup failed',str(e),parent=root)
        def open_folder():
            if os.name=='nt':os.startfile(data_dir)
            else:webbrowser.open(data_dir.as_uri())
        tk.Button(actions,text='Backup',command=backup,padx=12,pady=5).pack(side='left')
        tk.Button(actions,text='Open data folder',command=open_folder,padx=12,pady=5).pack(side='left',padx=8)
        tk.Label(frame,text='Keep this window open while you work.\nClosing it stops the app; saved data stays on disk.',font=('Segoe UI',10),fg='#66758b',bg='#f5f8fc',justify='left').pack(anchor='w',pady=3)
        def stop():
            if messagebox.askokcancel('Close Worklog Lite?','Save any open editor first. Stop the local app now?',parent=root):
                root.destroy()
        root.protocol('WM_DELETE_WINDOW',stop)
        root.after(400,lambda:webbrowser.open(url))
        try:root.mainloop()
        finally:server.shutdown();server.server_close();thread.join(timeout=5)
    finally:lock.close()

def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--data-dir',type=Path,default=default_data_dir())
    parser.add_argument('--restore',type=Path)
    parser.add_argument('--self-test',action='store_true')
    parser.add_argument('--test-report',type=Path)
    parser.add_argument('--reset-login',action='store_true')
    args=parser.parse_args()
    if args.self_test:
        from smoke_test import run
        try:
            if os.name=='nt':
                probe=tk.Tk();probe.withdraw();probe.update_idletasks();probe.destroy()
            result=run();result['checks'].append('native launcher toolkit');code=0
        except Exception:
            result={'ok':False,'error':traceback.format_exc()};code=1
        if args.test_report:
            args.test_report.parent.mkdir(parents=True,exist_ok=True)
            args.test_report.write_text(json.dumps(result,ensure_ascii=False,indent=2),encoding='utf-8')
        if sys.stdout:print(json.dumps(result))
        return code
    if args.restore or args.reset_login:
        args.data_dir.mkdir(parents=True,exist_ok=True)
        lock=InstanceLock(args.data_dir/'application.lock')
        try:
            root=tk.Tk();root.withdraw()
            if args.restore:
                if not messagebox.askokcancel('Restore workspace','Restore this backup? The current database will be saved separately first.',parent=root):return 0
                restore_file(args.restore,args.data_dir/'worklog.sqlite3')
                messagebox.showinfo('Restored','Workspace restored. Start Worklog Lite normally.',parent=root)
            else:
                from tkinter.simpledialog import askstring
                username=askstring('Local account','Username:',parent=root)
                if username is None:return 0
                password=askstring('Local account','New password (8+ characters):',show='*',parent=root)
                if password is None:return 0
                confirm=askstring('Local account','Confirm new password:',show='*',parent=root)
                if password!=confirm:raise ValueError('Passwords do not match. Nothing changed.')
                save_auth(args.data_dir/'auth.json',password_record(username,password))
                messagebox.showinfo('Updated','Login updated. Start the app normally.',parent=root)
            root.destroy();return 0
        finally:lock.close()
    start_desktop(args.data_dir);return 0

if __name__=='__main__':
    try:raise SystemExit(main())
    except Exception as e:
        try:
            error_root=tk.Tk();error_root.withdraw();messagebox.showerror('Worklog Lite',str(e),parent=error_root);error_root.destroy()
        except Exception:
            if sys.stderr:traceback.print_exc()
        raise SystemExit(1)
