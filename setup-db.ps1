# Database setup script
$ErrorActionPreference = "Stop"

# Configuration
$mysqlPath = "mysql"
$dbName = "pet_hotel"
$rootPass = "" # Empty for no password

Write-Host "Setting up MySQL database..." -ForegroundColor Cyan

# Function to run MySQL command
function Invoke-MySQL {
    param (
        [string]$Command,
        [string]$InputFile
    )
    
    if ($InputFile) {
        if ($rootPass) {
            mysql -u root -p"$rootPass" < $InputFile
        } else {
            mysql -u root < $InputFile
        }
    } else {
        if ($rootPass) {
            echo $Command | mysql -u root -p"$rootPass"
        } else {
            echo $Command | mysql -u root
        }
    }
}

try {
    # Create database
    Write-Host "Creating database..." -ForegroundColor Green
    Invoke-MySQL -Command "CREATE DATABASE IF NOT EXISTS $dbName;"
    
    # Import schema
    Write-Host "Importing schema..." -ForegroundColor Green
    Invoke-MySQL -InputFile "schema.sql"
    
    # Import any initial data
    if (Test-Path "database.sql") {
        Write-Host "Importing initial data..." -ForegroundColor Green
        Invoke-MySQL -InputFile "database.sql"
    }

    Write-Host "Database setup completed successfully!" -ForegroundColor Green
} catch {
    Write-Host "Error: $_" -ForegroundColor Red
    exit 1
}

Write-Host "Setup complete! You can now start the application." -ForegroundColor Cyan
