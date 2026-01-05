import * as vscode from 'vscode';
import OpenAI from 'openai';
import * as path from 'path';
import * as fs from 'fs';
import { stringify } from 'querystring';


export class ExtProvider implements vscode.WebviewViewProvider {
  private _view?: vscode.WebviewView;
  private conversation: {role:"user"|"system"|"assistant"; content: string}[]=[
    {
      role:"system",
      content: "You are codebuddy, an assistant for coding"
    }
  ]
  

  constructor (private readonly _extensionUri: vscode.Uri){}

  resolveWebviewView(webviewView: vscode.WebviewView, context: vscode.WebviewViewResolveContext, token: vscode.CancellationToken): Thenable<void> | void {
    this._view=webviewView;

    webviewView.webview.options={
      localResourceRoots:[this._extensionUri],
      enableScripts:true, 
      
    }


    this.importHistory()
     


    this._view.webview.onDidReceiveMessage(async (message)=> {
      switch (message.command){
        case "groqChat":
          await this.handleQuery(message.prompt);

        }
      })

    webviewView.webview.html=getChatHTML();
    setTimeout(() => {
      this._view?.webview.postMessage({
        command:"writeHistory",
        content: this.conversation.filter(m => m.role ! == "system")
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



  private importHistory() {
    const path = this.getFilePath();
    if (!path) return undefined;

    if (fs.existsSync(path)){
      const history=fs.readFileSync(path,'utf-8');
      try{
        const parse=JSON.parse(history);
        if (Array.isArray(parse)) {
          this.conversation = [
          { role: "system", content: "You are codebuddy, an assistant for coding" },
            ...parse
          ];
}
        
      }
      catch{
        console.log("HIstory not parsed")
      }
    }

    console.log(path);
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
      "codebuddy.json"
    )
  }

  


}



export function activate(context: vscode.ExtensionContext){
	console.log("Extension is running");

  const provider= new ExtProvider(context.extensionUri);

  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider("codebuddyview",provider) 
  )
}




function getChatHTML(): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <script src="https://cdn.jsdelivr.net/npm/marked/marked.min.js"></script>
</head>
<body style="padding:20px;height:100vh;font-family:var(--vscode-font-family);">
  <h1>CodeBuddy Chat</h1>

  <div id="messages" style="height:70%;overflow-y:auto;border:1px solid var(--vscode-panel-border);padding:15px;margin-bottom:10px;border-radius:8px;"></div>

  <input id="prompt"
         style="width:70%;padding:12px;border:1px solid var(--vscode-input-border);border-radius:6px;font-size:14px;"
         placeholder="Ask Groq anything... (Press Enter)">
  <button id="sendBtn"
          style="padding:12px 20px;margin-left:8px;border:none;border-radius:6px;background:var(--vscode-button-background);color:var(--vscode-button-foreground);cursor:pointer;">
    Send
  </button>

  <div id="status" style="margin-top:8px;font-style:italic;color:var(--vscode-descriptionForeground);"></div>

  <script>
    const vscode = acquireVsCodeApi();
    const messagesEl = document.getElementById('messages');
    const promptInput = document.getElementById('prompt');
    const sendBtn = document.getElementById('sendBtn');
    const status = document.getElementById('status');

    let chatHistory = [];

    function renderChatHistory() {
      messagesEl.innerHTML = '';

      for (const msg of chatHistory) {
        const div = document.createElement('div');
        div.style.cssText = \`
          margin:12px 0; padding:12px; border-radius:8px; overflow-x:auto; word-wrap:break-word;
          max-height:500px; overflow-y:auto; max-width:60%;
          \${msg.role === 'user'
            ? 'background:var(--vscode-button-background); color:var(--vscode-button-foreground); margin-left:auto; max-width:80%; text-align:right'
            : 'background:var(--vscode-textBlockQuote-background); color:var(--vscode-textBlockQuote-foreground); max-width:80%;'
          }
        \`;
        div.innerHTML = marked.parse(msg.content);
        messagesEl.appendChild(div);
      }

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