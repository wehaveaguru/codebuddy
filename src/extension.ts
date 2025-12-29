import * as vscode from 'vscode';
import OpenAI from 'openai';



export function activate(context: vscode.ExtensionContext){
	console.log("Extension is running");
	let disposable=vscode.commands.registerCommand("codebuddy.openchat",async () => {
		const editor=vscode.window.activeTextEditor;
		if (!editor){
			vscode.window.showErrorMessage("No text editor found");
			return;
		}
		const position=editor?.selection.active;
		const text=editor?.document.lineAt(position.line).text;
		vscode.window.showInformationMessage(`Current line: ${text}`);

		const apiKey=new OpenAI({
			apiKey:'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',
			baseURL:'https://api.groq.com/openai/v1'
		}
		)

		
		const panel=vscode.window.createWebviewPanel("codebuddy.chat","CodeBuddy",vscode.ViewColumn.One,{
			enableScripts: true,
			retainContextWhenHidden: true}
		);

		panel.webview.html=
			`<!DOCTYPE html>
        <html>
        <body style="padding:20px">
          <h1>CodeBuddy Chat</h1>
          <button onclick="alert('JS enabled!')">Test</button>
        </body>
        </html>
      `;

	})


	context.subscriptions.push(disposable);
}

export function deactivate() {}