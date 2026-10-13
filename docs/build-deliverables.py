from pathlib import Path
import base64, json, tarfile
ROOT=Path(__file__).resolve().parents[1]
DEST=ROOT.parent/'deliverables'
DEST.mkdir(exist_ok=True)
files=[ROOT/'module.json',ROOT/'README.md',ROOT/'LICENSE',ROOT/'CHANGELOG.md']+sorted((ROOT/'scripts').glob('*.js'))+sorted((ROOT/'styles').glob('*.css'))
payload=[{'path':str(p.relative_to(ROOT)),'content':base64.b64encode(p.read_bytes()).decode()} for p in files]
encoded=base64.b64encode(json.dumps(payload,separators=(',',':')).encode()).decode()
ps=r'''# Máquina de Lanches 0.4.2 - instalador local, sem rede e sem administrador.
param([string]$FoundryDataPath)
$ErrorActionPreference = 'Stop'
try {
  if (-not $FoundryDataPath) {
    Add-Type -AssemblyName System.Windows.Forms
    $picker = New-Object System.Windows.Forms.FolderBrowserDialog
    $picker.Description = 'Selecione a pasta Data do Foundry (contém modules, worlds e systems).'
    if ($picker.ShowDialog() -ne [System.Windows.Forms.DialogResult]::OK) { exit 0 }
    $FoundryDataPath = $picker.SelectedPath
  }
  $dataRoot = [System.IO.Path]::GetFullPath($FoundryDataPath)
  if (-not (Test-Path -LiteralPath (Join-Path $dataRoot 'modules') -PathType Container)) {
    throw 'Pasta inválida. Escolha a pasta Data do Foundry, que contém a pasta modules.'
  }
  $targetRoot = Join-Path (Join-Path $dataRoot 'modules') 'holosuite-vending'
  if (Test-Path -LiteralPath $targetRoot) {
    $backupRoot = Join-Path (Join-Path $dataRoot 'module-backups') ('maquina-de-lanches-' + (Get-Date -Format 'yyyyMMdd-HHmmss-fff'))
    [System.IO.Directory]::CreateDirectory($backupRoot) | Out-Null
    Copy-Item -LiteralPath $targetRoot -Destination $backupRoot -Recurse
    Write-Host ('Cópia da instalação anterior salva em: ' + $backupRoot)
  }
  $jsonText = [System.Text.Encoding]::UTF8.GetString([System.Convert]::FromBase64String('__PAYLOAD__'))
  $files = ConvertFrom-Json -InputObject $jsonText
  New-Item -ItemType Directory -Path $targetRoot -Force | Out-Null
  foreach ($file in $files) {
    $relative = $file.path.Replace('/', [System.IO.Path]::DirectorySeparatorChar)
    $filePath = [System.IO.Path]::GetFullPath((Join-Path $targetRoot $relative))
    if (-not $filePath.StartsWith($targetRoot + [System.IO.Path]::DirectorySeparatorChar, [System.StringComparison]::OrdinalIgnoreCase)) { throw 'Caminho de arquivo inválido.' }
    [System.IO.Directory]::CreateDirectory([System.IO.Path]::GetDirectoryName($filePath)) | Out-Null
    [System.IO.File]::WriteAllBytes($filePath, [System.Convert]::FromBase64String($file.content))
  }
  Write-Host 'Instalado! Abra o Foundry 13 e ative Máquina de Lanches.' -ForegroundColor Green
  Write-Host $targetRoot
} catch {
  Write-Host $_.Exception.Message -ForegroundColor Red
  exit 1
}
'''.replace('__PAYLOAD__',encoded)
(DEST/'Instalar-Maquina-de-Lanches.ps1').write_text(ps,encoding='utf-8-sig')
for name in ['Maquina-de-Lanches-Preview.html','Gerenciamento-Mestre-Preview.html']:
    (DEST/name).write_bytes((ROOT/name).read_bytes())
with tarfile.open(DEST/'maquina-de-lanches-source.tar.gz','w:gz') as archive:
    for p in sorted(ROOT.rglob('*')):
        if p.is_file() and not any(part in p.parts for part in ['__pycache__','.git','dist','node_modules']):
            archive.add(p,arcname='holosuite-vending/'+str(p.relative_to(ROOT)))
# Verify every payload byte and every archived source before delivering.
decoded=json.loads(base64.b64decode(encoded))
for p,item in zip(files,decoded):
    assert p.read_bytes()==base64.b64decode(item['content'])
with tarfile.open(DEST/'maquina-de-lanches-source.tar.gz') as archive:
    for member in archive.getmembers():
        original=ROOT/member.name.removeprefix('holosuite-vending/')
        assert archive.extractfile(member).read()==original.read_bytes()
print(json.dumps([{'path':str(p),'bytes':p.stat().st_size} for p in sorted(DEST.iterdir())],indent=2))
