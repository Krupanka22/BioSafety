# Configuration-Only Setup Scripts

**For users who already have Node.js, Python, and PostgreSQL installed.**

These scripts will:
- ✅ Copy environment files (.env)
- ✅ Create PostgreSQL database
- ✅ Load database schema
- ✅ Seed sample data

They will **NOT** install anything.

---

## 🚀 Usage

### **Windows PowerShell**
```powershell
cd "D:\RVCE\4th sem EL\Bio_Safety\Biosafety"
.\config-setup.ps1
```

### **Windows Command Prompt**
```cmd
cd D:\RVCE\4th sem EL\Bio_Safety\Biosafety
config-setup.bat
```

### **Mac/Linux Bash**
```bash
cd /path/to/biosafety
chmod +x config-setup.sh
./config-setup.sh
```

---

## 📝 After Running

1. **Edit `backend/.env`** - Update PostgreSQL password:
   ```env
   DB_PASSWORD=your_actual_password
   ```

2. **Install dependencies** manually:
   ```bash
   cd frontend && npm install
   cd backend && npm install
   cd ai-engine && pip install -r requirements.txt
   ```

3. **Start services** in 3 terminals:
   ```bash
   # Terminal 1
   cd frontend && npm run dev
   
   # Terminal 2
   cd backend && npm run dev
   
   # Terminal 3
   cd ai-engine && python app.py
   ```

4. **Access application**: http://localhost:5173
   - Email: john@example.com
   - Password: password123

---

That's it! 🎉
