import * as vscode from 'vscode';
import OpenAI from 'openai';
import * as path from 'path';
import * as fs from 'fs';
import { stringify } from 'querystring';
import { ChatCompletionMessageParam } from 'openai/resources/chat/completions';



export class ExtProvider implements vscode.WebviewViewProvider {
  private _view?: vscode.WebviewView;
  private conversation: ChatCompletionMessageParam[]=[{
    role:"system",
    content: "You are codebuddy, an AI assistant"
  }]

  private weather : any=
        {
          type : "function",
            function : {
            name : "get_weather",
            description: "Call this to get weather data",
            parameters: {
              type : "object",
              properties : {
                city : { type : "string"}
              },
              required: ["city"]
            }
          }
        }

  private addCode : any = {
    type:"function",
    function: {
      name: "add_code",
      description: "Call this to create a new file in and paste the code, after giving confirmation",
      parameters : {
        type:"object",
        properties: {
          prompt : {type: "string"}
        },
        required: ["prompt"]
      }
    }
  }
      
  

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
        case 'groqChat':
          await this.handleQuery(message.prompt,message.model)
          break;
      }
      })

    webviewView.webview.html=getChatHTML();
    setTimeout(() => {
      console.log("recieived webview")
      this._view?.webview.postMessage({
        command:"loadHistory",
        content: this.conversation.filter(m => m.role !== "system")
      })
    })

    
  }

 

  private async handleQuery(prompt: string, modelSelected : string) {
    
    const apiKey ="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"
    if (!apiKey){
      this._view?.webview.postMessage([{command:"error",content:"ApiKey Not found"}])
    }
    const client= new OpenAI({
      apiKey,
      baseURL:'https://openrouter.ai/api/v1'
    })

    
    this.conversation.push({
      role: "user",
      content: prompt
    })
    this.writeHistory(this.conversation);


    try {
    const response= await client.chat.completions.create({
			model: modelSelected,
			messages:this.conversation,
      tools: [this.weather,this.addCode],
      tool_choice:"auto",
			max_tokens:1000,
			temperature:0.7
		})

    
		const ans=response.choices[0]?.message?.content||"No answer";
    const message=response.choices[0].message;
    if (message.tool_calls && message.tool_calls.length>0){
      await this.tool_calling(message,modelSelected);
      return; 
    }

    this.conversation.push({
      role: "assistant",
      content: ans 
    })

    this._view?.webview.postMessage({command:"response",content:ans})
  

    this.writeHistory(this.conversation);
    
		this._view?.webview.postMessage({command:"response",content:ans});
  }
  catch (error)  {
    console.error(error); 
    this._view?.webview.postMessage({command:"error",error:"Error in sending the message" })
  }


	}

  private async tool_calling(message : any,modelSelected:string) {
    
      const tool:any =message.tool_calls[0];
      console.log(message);
      const args=JSON.parse(tool.function.arguments);
      const city=args.city
      const result =  await this.get_weather(city)
      console.log(result)

      this.conversation.push(message)

      this.conversation.push({
        role:"tool",
        tool_call_id:tool.id,
        content:JSON.stringify(result)
      })
      const apiKey="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"
        
      const client= new OpenAI({
        apiKey,
        baseURL:'https://openrouter.ai/api/v1'
      })

      const secondCall= await client.chat.completions.create({
        model: modelSelected,
        messages: this.conversation
      })

      const finalResponse= secondCall.choices[0].message.content
      this.conversation.push({
        role: "assistant",
        content:finalResponse
      })
      this._view?.webview.postMessage({command:"response", content: finalResponse})
      this.writeHistory(this.conversation)


    
  }

private async get_weather(city : string): Promise <any>{
  const api="6153b722b8864836a45111504261201";
  const url = `http://api.weatherapi.com/v1/current.json?key=${api}&q=${city}&aqi=no`;

  try {
    const data= await fetch(url);
    if (!data.ok) throw new Error(`HTTP Error!`)
    const response: any= await data.json();
    console.log(response);
    return {
      city: response.location.name,
    country: response.location.country,
    weather: response.current.condition.text,
    temp: response.current.temp_c
    }
  }
  catch {
    console.log("Error in fetching data")
    return;
  }
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
    
   .editable {
  outline: none;
        }     
    
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
  <h1 id="title" contenteditable="true" class="editable">CodeBuddy Chat</h1>

  <div id="messages" style="height:70%;overflow-y:auto;border:1px solid var(--vscode-panel-border);padding:15px;margin-bottom:10px;border-radius:8px;"></div>
<div style="display:flex; flex-direction: column; gap: 8px;">
  <select id="modelSelect" 
          style="width: 100%; padding: 4px; background: var(--vscode-dropdown-background); color: var(--vscode-dropdown-foreground); border: 1px solid var(--vscode-dropdown-border); border-radius: 4px;">
    <option value="meta-llama/llama-3.3-70b-instruct">Llama</option>
    <option value="mistralai/mixtral-8x7b-instruct">Mistral Ai</option>
    <option value="google/gemma-2-9b-it">Gemma</option>
  </select>
</div>
<div style="display:flex; gap: 8px;">
  <input id="prompt"
         style="width:70%;padding:12px;border:1px solid var(--vscode-input-border);border-radius:6px;font-size:14px;"
         placeholder="Ask anything... (Press Enter)">
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
    const model = document.getElementById('modelSelect');
    const title = document.getElementById('title');
    title.focus();
    

    title.addEventListener('mouseenter', () => {
        title.style.color = 'white';
     title.style.backgroundColor = '#222';
      title.style.padding = '4px 8px';
      title.style.borderRadius = '6px';})
    
    title.addEventListener('mouseleave', () => {
     title.style.color = ''
     title.style.backgroundColor = '';
      title.style.padding = '';
  title.style.borderRadius = '';})

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
      if (!msg.content) return
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
      vscode.postMessage({ command: 'groqChat', prompt: text, model : model.value});
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