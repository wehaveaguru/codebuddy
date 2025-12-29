import * as vscode from 'vscode';
import OpenAI from 'openai';



export function activate(context: vscode.ExtensionContext){
	console.log("Extension is running");
	let disposable=vscode.commands.registerCommand("codebuddy.openchat",async () => {
		
		


		
		const panel=vscode.window.createWebviewPanel("codebuddy.chat","CodeBuddy",vscode.ViewColumn.Beside,{
			enableScripts: true,
			retainContextWhenHidden: true}
		);

		panel.webview.html=
			`<!DOCTYPE html>
        <html>
        <body style="padding:20px">
        <h1>CodeBuddy Chat</h1>
        </body>
        </html>
      `;

	})


	context.subscriptions.push(disposable);
}

export async function sendtoGroq(webview: vscode.Webview, prompt: string){
	const apiKey=vscode.workspace.getConfiguration('codebuddy').get('apiKey') as string;
	if (!apiKey){
		webview.postMessage({command:"error",content:"Not available"})
		return;
	}

	try{
		const client=new OpenAI({
			apiKey,
			baseURL:'https://api.groq.com/openai/v1'
		})



		
	}

	catch(error:any){
		webview.postMessage({command: "error",content:`${error.message}`})
	}


}
export function deactivate() {}