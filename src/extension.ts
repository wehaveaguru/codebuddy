import * as vscode from 'vscode';
import OpenAI from 'openai';
import * as path from 'path';
import * as fs from 'fs';
import { stringify } from 'querystring';
import * as crypto from 'crypto';


export class ExtProvider implements vscode.WebviewViewProvider {
  private _view?: vscode.WebviewView;
  private conversation: {role:"user"|"system"|"assistant"; content: string}[]=[
    {
      role:"system",
      content: "You are codebuddy, an assistant for coding"
    }
  ]
  

  constructor (private readonly _extensionUri: vscode.Uri,private readonly _context: vscode.ExtensionContext) {
    this.conversation=this.readHistory();
    const workspaceListener = vscode.workspace.onDidChangeWorkspaceFolders(() => {
      this.refreshHistory();
    });

    this._context.subscriptions.push(workspaceListener);
  }

  resolveWebviewView(webviewView: vscode.WebviewView, context: vscode.WebviewViewResolveContext, token: vscode.CancellationToken): Thenable<void> | void {
    this._view=webviewView;

    this._view.webview.options={
      localResourceRoots:[this._extensionUri],
      enableScripts:true

    }

   

    
    this._view.webview.onDidReceiveMessage(async (message)=> {
      switch (message.command){
        case "groqChat":
          await this.handleQuery(message.prompt);

        }
      })

    webviewView.webview.html=getChatHTML();
    setTimeout(() => {
      this._view?.webview.postMessage({
        command:"loadHistory",
        content: this.conversation.filter(m => m.role !== "system")
      })
    })
  }

 

  private async handleQuery(prompt: string) {
    const apiKey ="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";
    if (!apiKey){
      this._view?.webview.postMessage([{command:"error",content:"ApiKey Not found"}])
    }
    const client= new OpenAI({
      apiKey,
      baseURL:'https://api.groq.com/openai/v1'
    })


    

    this.conversation.push({
      role: "user",
      content: prompt
    })
    

    this.writeHistory(this.conversation);

    const response=client.chat.completions.create({
			model:'llama-3.3-70b-versatile',
			"messages":this.conversation,
			max_tokens:1000,
			temperature:0.7
		})
		const ans= (await response).choices[0]?.message?.content||"NO answer";
    this.conversation.push({
      role: "assistant",
      content: ans
    })
    
    
    this.writeHistory(this.conversation);
    
		this._view?.webview.postMessage({command:"response",content:ans});


	}

private readHistory(): any[] {
    const filepath = this.getFilePath();
    
    if (!filepath || !fs.existsSync(filepath)) {
        return [{
            role: "system",
            content: "You are codebuddy, an assistant for coding"
        }];
    }

    try {
        const data = fs.readFileSync(filepath, 'utf-8');
        return JSON.parse(data);
    } catch (err) {
        return [{ role: "system", content: "You are codebuddy, an assistant for coding" }];
    }
}

  private refreshHistory(){
    this.conversation=this.readHistory();
    
    this._view?.webview.postMessage({
      command:"loadHistory",
      content: this.conversation.filter(m=> m.role !== "system")
    })
  }

  private writeHistory(content: any){
    const filepath = this.getFilePath();
    if (!filepath) return undefined;

    fs.mkdirSync(path.dirname(filepath),{recursive:true});

    fs.writeFileSync(filepath,JSON.stringify(content, null,2),'utf-8');
  }

  private getFilePath(){
    const workspace=vscode.workspace.workspaceFolders?.[0];
    if (!workspace) return undefined;
    
    

    return path.join(
      workspace.uri.fsPath,
      ".vscode",
      "chat-histories",
      `codebuddy.json`
    );
  }

  


}



export function activate(context: vscode.ExtensionContext){
	console.log("Extension is running");

  const provider= new ExtProvider(context.extensionUri,context);  



  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider("codebuddyview",provider,{
      webviewOptions: {
        retainContextWhenHidden: true}
    }) 
  )
}




function getChatHTML(): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <script src="https://cdn.jsdelivr.net/npm/marked/marked.min.js"></script>
  <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/styles/github-dark.min.css">
  <script src="https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/highlight.min.js"></script>

  <style>
  body { padding: 20px; height: 100vh; font-family: var(--vscode-font-family); color: var(--vscode-foreground); }
    #messages { height: 75%; overflow-y: auto; border: 1px solid var(--vscode-panel-border); padding: 15px; margin-bottom: 10px; border-radius: 8px; }
    
    
    pre { position: relative; background: #1e1e1e; padding: 10px; border-radius: 5px; overflow-x: auto; }
    code { font-family: var(--vscode-editor-font-family); font-size: 13px; }
    
    
    .copy-btn {
      position: absolute; top: 5px; right: 5px;
      padding: 4px 8px; font-size: 10px; cursor: pointer;
      background: var(--vscode-button-background); color: var(--vscode-button-foreground);
      border: none; border-radius: 4px; opacity: 0.7;
    }
    .copy-btn:hover { opacity: 1; }

    .msg-bubble { margin: 12px 0; padding: 12px; border-radius: 8px; max-width: 85%; word-wrap: break-word; }
    .user { background: var(--vscode-button-background); color: var(--vscode-button-foreground); margin-left: auto; }
    .bot { background: var(--vscode-textBlockQuote-background); color: var(--vscode-foreground); border: 1px solid var(--vscode-panel-border); }
  </style>
</head>
<body style="padding:20px;height:100vh;font-family:var(--vscode-font-family);">
  <h1>CodeBuddy Chat</h1>

  <div id="messages" style="height:70%;overflow-y:auto;border:1px solid var(--vscode-panel-border);padding:15px;margin-bottom:10px;border-radius:8px;"></div>

<div style="display:flex; gap: 8px;">
  <input id="prompt"
         style="width:70%;padding:12px;border:1px solid var(--vscode-input-border);border-radius:6px;font-size:14px;"
         placeholder="Ask Groq anything... (Press Enter)">
  <button id="sendBtn"
          style="padding:12px 20px;margin-left:8px;border:none;border-radius:6px;background:var(--vscode-button-background);color:var(--vscode-button-foreground);cursor:pointer;"> 
          Send 
  </button>
  </div>

  <div id="status" style="margin-top:8px;font-style:italic;color:var(--vscode-descriptionForeground);"></div>

  <script>
    const vscode = acquireVsCodeApi();
    const messagesEl = document.getElementById('messages');
    const promptInput = document.getElementById('prompt');
    const sendBtn = document.getElementById('sendBtn');
    const status = document.getElementById('status');

    let chatHistory = [];

    marked.setOptions({
      highlight: function(code, lang) {
        const language = hljs.getLanguage(lang) ? lang : 'plaintext';
        return hljs.highlight(code, { language }).value;
      }
    });

    function renderChatHistory() {
      messagesEl.innerHTML = '';
      chatHistory.forEach(msg => {
        const div = document.createElement('div');
        div.className = 'msg-bubble ' + (msg.role === 'user' ? 'user' : 'bot');
        
        div.innerHTML = marked.parse(msg.content);
        
        
        div.querySelectorAll('pre').forEach(pre => {

        const codeEl = pre.querySelector('code');
        const isActualCode = codeEl.className.includes('language-') || codeEl.classList.contains('hljs');

        if (isActualCode) {
          const btn = document.createElement('button');
          btn.innerText = 'Copy';
          btn.className = 'copy-btn';
          btn.onclick = () => {
            const code = pre.querySelector('code').innerText;
            navigator.clipboard.writeText(code);
            btn.innerText = 'Copied!';
            setTimeout(() => btn.innerText = 'Copy', 2000);
          };
          pre.appendChild(btn);}
        });

        messagesEl.appendChild(div);
      });
      messagesEl.scrollTop = messagesEl.scrollHeight;
    }

    function addMessage(role, text) {
      chatHistory.push({ role, content: text });
      renderChatHistory();
    }

    function send() {
      const text = promptInput.value.trim();
      if (!text) return;
      addMessage('user', text);
      status.textContent = 'Thinking...';
      vscode.postMessage({ command: 'groqChat', prompt: text});
      promptInput.value = '';
    }

    window.addEventListener('message', event => {
      const message = event.data;

      if (message.command === 'response') {
        addMessage('bot', message.content);
        status.textContent = '';
      } else if (message.command === 'error') {
        addMessage('bot', message.content);
        status.textContent = '';
      }

      else if (message.command === 'loadHistory') {
      chatHistory = message.content;
      renderChatHistory();
      }


    });

    sendBtn.addEventListener('click', () => send());
    promptInput.addEventListener('keydown', e => {
      if (e.key === 'Enter') send();
    });

    addMessage('bot', 'CodeBuddy ready! Ask coding questions...');
  </script>
</body>
</html>`
;
}



export function deactivate() {}