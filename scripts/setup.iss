#define MyAppName "Mando"
#define MyAppVersion "0.1.0"
#define MyAppPublisher "Mando"
#define MyAppExeName "mando.exe"

[Setup]
AppId={{Mando-Virtual-Gamepad-7355}
AppName={#MyAppName}
AppVersion={#MyAppVersion}
AppPublisher={#MyAppPublisher}
DefaultDirName={autopf}\Mando
DisableProgramGroupPage=yes
PrivilegesRequired=admin
OutputDir=..\dist
OutputBaseFilename=MandoSetup
SetupIconFile=..\src\public\icons\icon.ico
UninstallDisplayIcon={app}\icon.ico
VersionInfoVersion={#MyAppVersion}
VersionInfoCompany={#MyAppPublisher}
VersionInfoDescription=Mando - Virtual Xbox 360 gamepad server
VersionInfoCopyright=Copyright (c) 2026 Mando
Compression=lzma
SolidCompression=yes
WizardStyle=modern

[Languages]
Name: "spanish"; MessagesFile: "compiler:Languages\\Spanish.isl"

[Tasks]
Name: "desktopicon"; Description: "{cm:CreateDesktopIcon}"; GroupDescription: "{cm:AdditionalIcons}"; Flags: unchecked
Name: "startup"; Description: "Iniciar Mando automáticamente al arrancar Windows"; GroupDescription: "Inicio automático"; Flags: checkedonce

[Files]
Source: "..\dist\mando.exe"; DestDir: "{app}"; Flags: ignoreversion
Source: "..\dist\ViGEmBus_1.22.0_x64_x86_arm64.exe"; DestDir: "{tmp}"; Flags: deleteafterinstall
Source: "..\src\public\icons\icon.ico"; DestDir: "{app}"; Flags: ignoreversion

[Icons]
Name: "{autoprograms}\Mando"; Filename: "{app}\{#MyAppExeName}"; IconFilename: "{app}\icon.ico"
Name: "{autodesktop}\Mando"; Filename: "{app}\{#MyAppExeName}"; IconFilename: "{app}\icon.ico"; Tasks: desktopicon

[Run]
Filename: "{tmp}\ViGEmBus_1.22.0_x64_x86_arm64.exe"; Parameters: "/exenoui /qn /norestart"; StatusMsg: "Instalando driver ViGEmBus..."; Check: NeedsViGEmBus
Filename: "{app}\{#MyAppExeName}"; Description: "Iniciar Mando"; Flags: nowait postinstall skipifsilent

[Registry]
Root: HKCU; Subkey: "Software\Microsoft\Windows\CurrentVersion\Run"; ValueType: string; ValueName: "Mando"; ValueData: """{app}\{#MyAppExeName}"" --autostart"; Tasks: startup

[Code]
var
  DidInstallViGEm: Boolean;

function NeedsViGEmBus: Boolean;
begin
  Result := not FileExists(ExpandConstant('{sys}\drivers\ViGEmBus.sys'));
end;

function InitializeSetup: Boolean;
begin
  DidInstallViGEm := NeedsViGEmBus;
  Result := True;
end;

procedure CurStepChanged(CurStep: TSetupStep);
var
  ResultCode: Integer;
begin
  if (CurStep = ssDone) and DidInstallViGEm then
  begin
    if MsgBox('ViGEmBus se ha instalado correctamente.' + #13#10 +
              'Es necesario reiniciar el sistema para que el driver funcione.' + #13#10 + #13#10 +
              '¿Quieres reiniciar ahora?',
              mbConfirmation, MB_YESNO) = IDYES then
    begin
      Exec(ExpandConstant('{cmd}'), '/c shutdown /r /t 5', '', SW_HIDE, ewWaitUntilTerminated, ResultCode);
    end;
  end;
end;

procedure CurUninstallStepChanged(CurUninstallStep: TUninstallStep);
begin
  if CurUninstallStep = usPostUninstall then
  begin
    RegDeleteValue(HKCU, 'Software\Microsoft\Windows\CurrentVersion\Run', 'Mando');
  end;
end;
