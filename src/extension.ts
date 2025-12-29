import * as vscode from 'vscode';

export function activate(context: vscode.ExtensionContext){
	console.log("Extension is running");
	let disposable=vscode.commands.registerCommand("codebuddy.helloWorld",async () => {
		const editor=vscode.window.activeTextEditor;
		if (!editor){
			vscode.window.showErrorMessage("No text editor found");
			return;
		}
		const position=editor?.selection.active;
		const text=editor?.document.lineAt(position.line).text;
		const value=editor.selection.isEmpty;
		vscode.window.showInformationMessage(`Current line: ${text},${value}`);

		

	})


	context.subscriptions.push(disposable);
}

export function deactivate() {}