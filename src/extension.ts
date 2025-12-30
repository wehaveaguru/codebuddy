import * as vscode from 'vscode';
import OpenAI from 'openai';




export function activate(context: vscode.ExtensionContext){
	console.log("Extension is running");
	let disposable=vscode.commands.registerCommand("codebuddy.openchat",async () => {
		
	context.globalState.get("chatHistory") as string;


		
		const panel=vscode.window.createWebviewPanel("codebuddy.chat","CodeBuddy",vscode.ViewColumn.Beside,{
			enableScripts: true,
			retainContextWhenHidden: true}
		);


		panel.webview.html=getChatHTML()

		panel.webview.onDidReceiveMessage(
			async (message) =>{
				if (message.command=='groqchat'){
					await sendtoGroq(panel.webview,message.prompt);
				}

			}
		);

    

		

	})


	context.subscriptions.push(disposable);
}

async function sendtoGroq(webview: vscode.Webview, prompt: string){
	const apiKey=vscode.workspace.getConfiguration('codebuddy').get('groqAPI') as string; 
  console.log(apiKey);
	if (!apiKey){
		webview.postMessage({command:"error",content:"Not available"})
		return;
	}

	try{
		const client=new OpenAI({
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
		webview.postMessage({command:"response",content:ans});

		
	}

	catch(error:any){
		webview.postMessage({command: "error",content:`${error.message}`})
	}


}

function getChatHTML(): string {
  return `<!DOCTYPE html>
<html>
<head>
  <script src="https://cdn.jsdelivr.net/npm/marked/marked.min.js"></script>
</head>
<body style="padding:20px;height:100vh;font-family:var(--vscode-font-family);">
  <h1>CodeBuddy Chat</h1>
 
  <div id="messages" style="height:70%;overflow-y:auto;border:1px solid var(--vscode-panel-border);padding:15px;margin-bottom:10px;border-radius:8px;"></div>
  

  <input id="prompt" style="width:70%;padding:12px;border:1px solid var(--vscode-input-border);border-radius:6px;font-size:14px;" placeholder="Ask Groq anything... (Ctrl+Enter)">
  <button onclick="send()" style="padding:12px 20px;margin-left:8px;border:none;border-radius:6px;background:var(--vscode-button-background);color:var(--vscode-button-foreground);cursor:pointer;">Send</button>
  

  <div id="status" style="margin-top:8px;font-style:italic;color:var(--vscode-descriptionForeground);"></div>

  <script>
    const vscode = acquireVsCodeApi();
    const messages = document.getElementById('messages');
    const promptInput = document.getElementById('prompt');
    const status = document.getElementById('status');

    function addMessage(sender, text) {
      const div = document.createElement('div');
      div.style.cssText = \`
        margin:12px 0; padding:12px; border-radius:8px;overflow-x:auto;word-wrap:break-word;max-height:500px;overflow-y:auto;max-width:60%;
        \${sender === 'user' ? 
          'background:var(--vscode-button-background); color:var(--vscode-button-foreground); margin-left:auto; max-width:80%; text-align:right' : 
          'background:var(--vscode-textBlockQuote-background); color:var(--vscode-textBlockQuote-foreground); max-width:80%;'
        }
      \`;
      div.innerHTML = marked.parse(text);
      messages.appendChild(div);
      messages.scrollTop = messages.scrollHeight;
    }

    function send() {
      const text = promptInput.value.trim();
      if (!text) return;
      addMessage('user', text);
      promptInput.value = '';
      vscode.postMessage({ command: 'groqchat', prompt: text });
    }

    window.addEventListener('message', event => {
      const message = event.data;
      if (message.command === 'response') {
        addMessage('bot', message.content);
        status.textContent = '';
      } else if (message.command === 'status') {
        status.textContent = message.content;
      } else if (message.command === 'error') {
        addMessage('bot', message.content);
        status.textContent = '';
      }
    });

    promptInput.addEventListener('keydown', e => {
      if ( e.key === 'Enter') send();
    });
    

    // WELCOME MESSAGE
    addMessage('bot', ' CodeBuddy ready! Ask coding questions...');
  </script>
</body>
</html>`;
}



export function deactivate() {}