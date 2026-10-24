# EGSA Academy — MongoDB Production Runtime & Operator Runbook

## 1. Current Verified Runtime State

- **Active Running Instance**: MongoDB Server 8.2.6 running on loopback `127.0.0.1:27017`.
- **Active Data Directory**: `D:\egsa_academy\data\mongodb\db` (Permanent Production Storage).
- **Diagnostics Log**: `D:\egsa_academy\data\mongodb\log\mongod.log`.
- **Database Separation**:
  - Student Backend (`:5000`): Connected to `egsa_academy` (44 collections, 100% verified).
  - Instructor Backend (`:5100`): Connected to `egsa_instructor` (15 collections, 100% verified).
  - Admin Backend (`:5200`): Connected to `esa_academy` (22 collections, 100% verified).
- **Preserved Snapshots & Recovery Copies**:
  - Original directory: `C:\Program Files\MongoDB\Server\8.2\data` (Untouched, preserved).
  - Physical snapshot: `D:\egsa_academy\backups\raw_mongo_snapshot_20261023_183755` (Untouched, preserved).
  - Verified logical backup: `D:\egsa_academy\backups\logical_backup_20261023_212500` (7,206 documents, 0 errors).
  - Scratch recovery copy: `D:\egsa_academy\scratch\mongo_recovery_test_db` (Preserved as fallback).

---

## 2. Operator Service Registration (Requires Elevated Administrator UAC)

Because standard user shells cannot install or modify Windows system services, the runtime currently executes as a local background daemon. To establish automatic startup on server reboot, execute the following steps in an **Elevated (Run as Administrator) PowerShell** window:

### Step 1: Gracefully Stop the Local Background Process
Identify and stop the running user-space `mongod.exe`:
```powershell
# In PowerShell:
Get-Process mongod -ErrorAction SilentlyContinue | Stop-Process -Force
```

### Step 2: Register or Update the Windows Service
Use the provided production configuration file `D:\egsa_academy\deploy\mongodb\mongod_production.cfg`:
```powershell
# Remove old or misconfigured service if present:
& "C:\Program Files\MongoDB\Server\8.2\bin\mongod.exe" --remove --serviceName "MongoDB"

# Install the permanent production service:
& "C:\Program Files\MongoDB\Server\8.2\bin\mongod.exe" `
  --config "D:\egsa_academy\deploy\mongodb\mongod_production.cfg" `
  --install `
  --serviceName "EGSA_MongoDB" `
  --serviceDisplayName "MongoDB Server (EGSA Production)"

# Set service startup to Automatic:
Set-Service -Name "EGSA_MongoDB" -StartupType Automatic

# Start the service:
Start-Service -Name "EGSA_MongoDB"
```

### Step 3: Verify Service Health
```powershell
# Verify service is running:
Get-Service -Name "EGSA_MongoDB"

# Verify all three backend health endpoints:
Invoke-RestMethod -Uri "http://127.0.0.1:5000/api/health"
Invoke-RestMethod -Uri "http://127.0.0.1:5100/api/v1/health"
Invoke-RestMethod -Uri "http://127.0.0.1:5200/api/health"
```

---

## 3. Safe Reversible Rollback Procedure

If the Windows Service fails to start (e.g., due to Windows permission constraints on `NT AUTHORITY\NetworkService` accessing the `D:\` drive):

1. **Check the Log**:
   Inspect `D:\egsa_academy\data\mongodb\log\mongod.log`.
2. **Immediate Reversible Fallback to User-Space Daemon**:
   Run mongod directly with:
   ```powershell
   & "C:\Program Files\MongoDB\Server\8.2\bin\mongod.exe" --dbpath "D:\egsa_academy\data\mongodb\db" --port 27017 --bind_ip 127.0.0.1 --logpath "D:\egsa_academy\data\mongodb\log\mongod.log" --logappend
   ```
3. **Emergency Rollback to Scratch Recovery Copy**:
   If `D:\egsa_academy\data\mongodb\db` is ever damaged:
   ```powershell
   & "C:\Program Files\MongoDB\Server\8.2\bin\mongod.exe" --dbpath "D:\egsa_academy\scratch\mongo_recovery_test_db" --port 27017 --bind_ip 127.0.0.1
   ```
   All backends will immediately reconnect without data loss.
