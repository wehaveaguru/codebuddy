import * as vscode from 'vscode';
import OpenAI from 'openai';
import Groq from 'groq-sdk';



export function activate(context: vscode.ExtensionContext){
	console.log("Extension is running");
	let disposable=vscode.commands.registerCommand("codebuddy.openchat",async () => {
		
		


		
		const panel=vscode.window.createWebviewPanel("codebuddy.chat","CodeBuddy",vscode.ViewColumn.Beside,{
			enableScripts: true,
			retainContextWhenHidden: true}
		);

		panel.webview.html=`
		<!DOCTYPE html>
		<body>
		<h1> CodeBuddy Chat </h1>
		</body>`

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

		const response=client.chat.completions.create({
			model:"gpt-4-turbo-2024-04-09",
			"messages":[{"role":"user","content":prompt}],
			max_tokens:1000,
			temperature:0.7
		})
		const ans= (await response).choices[0]?.message?.content||"NO answer";
		webview.postMessage({command:"answer",content:ans});

		
	}

	catch(error:any){
		webview.postMessage({command: "error",content:`${error.message}`})
	}


}


export function deactivate() {}