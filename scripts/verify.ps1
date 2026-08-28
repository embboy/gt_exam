param(
    [string]$PythonExecutable = "python"
)

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
Push-Location $root
try {
    [xml](Get-Content "pom.xml" -Raw) | Out-Null
    [xml](Get-Content "backend/pom.xml" -Raw) | Out-Null
    Get-Content "frontend/package.json" -Raw | ConvertFrom-Json | Out-Null
    Get-Content "frontend/tsconfig.json" -Raw | ConvertFrom-Json | Out-Null
    Get-Content "ai/schemas/question.schema.json" -Raw | ConvertFrom-Json | Out-Null

    $classes = Join-Path $env:TEMP "gt-exam-domain-classes"
    Remove-Item $classes -Recurse -Force -ErrorAction SilentlyContinue
    New-Item -ItemType Directory -Path $classes | Out-Null
    $sources = @(Get-ChildItem "backend/src/main/java/com/gtexam/exam/domain/*.java" | ForEach-Object FullName)
    $sources += (Resolve-Path "backend/src/test/java/com/gtexam/exam/domain/ExamDomainSmoke.java").Path
    & javac --release 21 -d $classes $sources
    if ($LASTEXITCODE -ne 0) { throw "Java domain compilation failed" }
    & java -cp $classes com.gtexam.exam.domain.ExamDomainSmoke
    if ($LASTEXITCODE -ne 0) { throw "Java domain smoke check failed" }

    Push-Location "ai/validators"
    try {
        & $PythonExecutable -m unittest -v test_validate_question.py
        if ($LASTEXITCODE -ne 0) { throw "AI validator tests failed" }
    } finally {
        Pop-Location
    }

    $migration = Get-Content "backend/src/main/resources/db/migration/V1__baseline.sql" -Raw
    if (!$migration.Contains("uq_official_mock_question")) {
        throw "Official question uniqueness constraint is missing"
    }
    Write-Output "Repository verification passed"
} finally {
    Pop-Location
}