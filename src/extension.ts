import * as vscode from 'vscode';
import OpenAI from 'openai';
import * as path from 'path';
import * as fs from 'fs';
import { stringify } from 'querystring';


export class ExtProvider implements vscode.WebviewViewProvider {
  private _view?: vscode.WebviewView;
  private _extensionUri?: vscode.Uri;

  constructor (private extensionUri: vscode.Uri){
    this._extensionUri=extensionUri;
  }

  resolveWebviewView(webviewView: vscode.WebviewView, context: vscode.WebviewViewResolveContext, token: vscode.CancellationToken): Thenable<void> | void {
    this._view=webviewView;

    webviewView.webview.options={
      
      enableScripts:true,
      
    }

    this._view.webview.onDidReceiveMessage(async (message)=> {
      switch (message.command){
        case "groqChat":
          await this.handleQuery(message.prompt);
      }
    })

    webviewView.webview.html=getChatHTML();
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

    const response=client.chat.completions.create({
			model:'llama-3.3-70b-versatile',
			"messages":[{"role":"user","content":prompt}],
			max_tokens:1000,
			temperature:0.7
		})
		const ans= (await response).choices[0]?.message?.content||"NO answer";
		this._view?.webview.postMessage({command:"response",content:ans});
	}

	catch(error:any){
		this._view?.webview.postMessage({command: "error",content:`${error.message}`})
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
      promptInput.value = '';
      status.textContent = 'Thinking...';
      vscode.postMessage({ command: 'groqChat', prompt: text });
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