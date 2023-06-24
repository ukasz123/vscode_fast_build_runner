/* eslint-disable curly */
import * as vscode from "vscode";

export function activate(context: vscode.ExtensionContext) {
  let disposable = vscode.commands.registerCommand(
    "build-runner.quickly",
    async () => {
      function _baseFolder(path: string): string | null {
        /// Guard against untitled files
        const isUntitled = vscode.window.activeTextEditor?.document.isUntitled;
        if (isUntitled) return null;

        /// Guard against no workspace name
        const workspaceFolder = vscode.workspace.getWorkspaceFolder(uri!);
        const workspaceName = workspaceFolder?.name;
        if (workspaceName === undefined) return null;

        /// Guard against no workspace path
        const workspacePath = workspaceFolder?.uri.path;
        if (workspacePath === undefined) [];

        const relativePath = path?.replace(workspacePath!, "");
        const segments = relativePath?.split("/").filter((e) => e !== "");

        /// Guard against no top level folder
        const hasTopLevelFolder = segments!.length > 1;
        if (!hasTopLevelFolder) return null;

        const segmentsWithoutFilename = [...segments!].slice(
          0,
          segments!.length - 1
        );
        const bottomLevelFolder = `${workspacePath}/${segmentsWithoutFilename.join(
          "/"
        )}`;
        return bottomLevelFolder;
      }

      function _route(path: string): Array<String> | null {
        const targetFile = path;

        /// Guard against common generated files
        const targetIsFreezed = targetFile?.endsWith(".freezed.dart");
        const targetIsGenerated = targetFile?.endsWith(".g.dart");
        if (targetIsFreezed) return [`/**`];
        if (targetIsGenerated) return [`/**`];

        /// get parts
        const text = vscode.window.activeTextEditor?.document.getText();
        const parts = text
          ?.match(/^part '.*';$/gm)
          ?.map((e) => e.replace(/^part '/, "").replace(/';$/, ""));

        const hasParts = !(
          parts === undefined ||
          parts === null ||
          parts?.length === 0
        );

        if (!hasParts) return [`/**`];

        const buildFilters = parts!.map((e) => `/${e}`);

        return [...buildFilters];
      }

      /// Get the current editor file uri and path
      const uri = vscode.window.activeTextEditor?.document.uri;
      const documentPath = uri?.path;

      /// Guard against welcome screen
      const isWelcomeScreen = documentPath === undefined;
      if (isWelcomeScreen) {
        vscode.window.showInformationMessage(
          `Please select a project to run build_runner in`
        );
        return;
      }

      const bottomLevelFolder = _baseFolder(documentPath!);
      const filters = await _route(documentPath)?.map(
        (pattern) => `${bottomLevelFolder}${pattern}`
      );

      /// get dart configuration
      const config =  vscode.workspace.getConfiguration('dart');
      /// get chosen workspace SDK path
      const flutterSdkPath = config.get('flutterSdkPath');
      /// generate path
      const commandPrefix =
        flutterSdkPath == null ? `dart` : `${flutterSdkPath}/bin/dart`;

      /// Null filters because no workspace, let's ask the user to pick a workspace
      /// so we can run build_runner on it
      if (filters === null || filters === undefined) {
        /// Pick a workspace folder
        const result = await vscode.window.showWorkspaceFolderPick();
        const workspaceFolderPath = result?.uri.path;

        /// No workspace selected intentionally
        if (workspaceFolderPath === undefined) {
          vscode.window.showInformationMessage(
            `Please select a project to run build_runner in`
          );
        }

        /// Workspace selected, lets run build_runner on it
        else {
          const command = `cd ${workspaceFolderPath} && ${commandPrefix} run build_runner build --delete-conflicting-outputs`;
          const terminal = vscode.window.createTerminal(`build_runner`);

          terminal.sendText(`${command};exit`);
          console.log(command);
          vscode.window.showInformationMessage(`Running build_runner quickly`);

          var disposeListener = vscode.window.onDidCloseTerminal((e) => {
            if (e.name === `build_runner`) {
              vscode.window.showInformationMessage(`build_runner process finished`);
              disposeListener.dispose();
            }
          });
        }
      }
      /// We've got an array which means everything worked out.
      /// It might be empty, but that's not a problem. That just
      /// means we won't have any build filters.
      else {
        const buildFilters = filters!
          .map((path) => `--build-filter="${path}"`)
          .join(" ");

        async function _findPackageBaseFolder(
          folder: string
        ): Promise<string | undefined> {
          if (folder === "/") return undefined;

          const hasPubspec = await vscode.workspace
            .findFiles(new vscode.RelativePattern(folder, "pubspec.yaml"))
            .then((e) => e.length > 0);
          if (hasPubspec) return folder;
          return _findPackageBaseFolder(
            folder.split("/").slice(0, -1).join("/")
          );
        }
        const packageBaseFolder = await _findPackageBaseFolder(
          bottomLevelFolder!
        );

        const terminal = vscode.window.createTerminal(`build_runner`);

        const command = `${
          packageBaseFolder ? `cd ${packageBaseFolder} && ` : ''
        }${commandPrefix} run build_runner build --delete-conflicting-outputs ${buildFilters}`;

        /// Attempt to build with filters
        terminal.sendText(`${command};exit`);
        console.log(command);
        vscode.window.showInformationMessage(`Running build_runner quickly`);

        var disposeListener = vscode.window.onDidCloseTerminal((e) => {
          if (e.name === `build_runner`) {
            vscode.window.showInformationMessage(`build_runner process finished`);
            disposeListener.dispose();
          }
        });
      }
    }
  );

  context.subscriptions.push(disposable);
}

// this method is called when your extension is deactivated
export function deactivate() { }
