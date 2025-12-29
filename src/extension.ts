import * as vscode from 'vscode';

export function activate(context: vscode.ExtensionContext){
	console.log("Extension is running");
	let disposable=vscode.commands.registerCommand("codebuddy.helloWorld",() => {
		vscode.window.showInformationMessage("extension is up and running");
	})
	context.subscriptions.push(disposable);
}

export function deactivate() {}