# Smart Battery Alert ⚡🔋

A **lightweight**, **non-invasive** GNOME Shell extension that gives you full control over your laptop's battery health — without touching the BIOS or kernel.

> **Why does this exist?** Most laptops (HP, Dell, Lenovo, and others) don't support BIOS-level charge control. This extension solves the 99% problem by giving you **smart notifications** instead.

---

## ✨ Features

### 🔋 Smart Low Battery Alerts
- Starts alerting when battery drops below **30%**
- Sends a notification for every **2% decrease**
- At **20%**, a **persistent modal dialog** blocks the screen — it only disappears when you connect the charger
- **Custom sound alerts** for different battery events

### ⚡ Charge Time Prediction
- When you plug in the charger, shows the **exact clock time** your battery will be charged
- Example: _"Charged by 12:15 PM"_ (not "in 2 hours 15 minutes")
- Uses **Exponential Moving Average** for accurate prediction

### 🛡️ Charge Limit Alarm
- Set a charge limit at **70%**, **80%**, or **90%** with one click
- Get alerted the moment your battery hits the limit
- **Continuous alerts every 1%** if you keep it charging past the limit
- **Non-invasive**: Does NOT modify kernel, BIOS, or charging hardware

### 📊 Battery Health Tracking
- **Monitor battery capacity degradation** over time
- Track **charge cycle count** automatically (accumulates 100% discharged = 1 cycle)
- Get **warnings when battery health drops** below threshold
- View battery health percentage in the panel menu
- Logs battery capacity data for long-term analysis

### 📈 Usage Statistics
- Track **time spent charging vs. discharging**
- Log battery usage patterns automatically
- Historical data stored in JSON format

### 🔊 Sound Alerts
- **System sounds** for battery events
- Sounds for low battery, charge limit, and full charge
- **Adjustable volume control** (0-100%)
- Enable/disable sounds globally

### 💤 Shutdown Workflow
- Want to shut down while charging? The popup displays:
  _"📱 Set a phone alarm for 12:15 PM, then shut down safely"_
- So the extension is useful even when your laptop is off!

### 🪶 Lightweight
- **Event-driven** architecture using UPower D-Bus signals
- **Zero CPU** when nothing is changing (no subprocess polling)
- No background processes, no kernel modules

---

## 📦 Installation

### Manual Installation

```bash
git clone https://github.com/KomeshBathula/smart-battery-alert.git
cd smart-battery-alert
make install
```

Then restart GNOME Shell:
- **Wayland**: Log out and log back in
- **X11**: Press `Alt+F2`, type `r`, press Enter

Enable the extension:
```bash
gnome-extensions enable smart-battery-alert@komesh.dev
```

### Uninstall

```bash
make uninstall
```

---

## ⚙️ Configuration

Open GNOME Extensions preferences or run:

```bash
gnome-extensions prefs smart-battery-alert@komesh.dev
```

| Setting | Default | Description |
|---------|---------|-------------|
| Show Battery Percentage | ✅ | Display % in top bar |
| Fallback Poll Interval | 30s | Safety net for D-Bus misses |
| Low Battery Threshold | 30% | Start alerting below this |
| Critical Battery Threshold | 20% | Show modal dialog below this |
| Alert Every N% | 2% | Notification interval on discharge |
| Charge Limit | 80% | Alert when charging reaches this |
| Charge Prediction | ✅ | Show estimated completion time |
| Health Warning Threshold | 80% | Alert when battery capacity drops below |
| Enable Sound Alerts | ✅ | Play sounds for notifications |
| Sound Volume | 50% | Volume level for alerts (0-100) |

---

## 🐧 Compatibility

| | Supported |
|---|---|
| **GNOME Shell** | 43, 44, 45, 46, 47, 48, 49 |
| **Fedora** | ✅ |
| **Ubuntu** | ✅ |
| **Arch Linux** | ✅ |
| **Debian** | ✅ |
| **openSUSE** | ✅ |
| **Any distro with UPower** | ✅ |

---

## 🏗️ Architecture

```
Extension (enable/disable)
  └─ BatteryMonitor (event-driven core)
       ├─ UPower D-Bus signals (notify::percentage, notify::state)
       ├─ Primary battery monitoring (first detected battery)
       ├─ Fallback timer (30s safety net)
       ├─ LowBattery controller → notifications every 2%
       ├─ CriticalBattery controller → modal dialog ≤20%
       ├─ ChargeLimit controller → alarm + over-charge alerts
       ├─ ChargePrediction → EMA-smoothed ETA
       ├─ BatteryHealth → degradation tracking + cycle count
       ├─ UsageStats → charging/discharging time tracking
       └─ SoundAlerts → system audio notifications
  └─ SmartBatteryIndicator (panel UI)
       ├─ Battery icon + percentage label
       ├─ Popup menu (status, ETA, charge limit, health, cycles)
       ├─ Quick-set buttons (70% / 80% / 90%)
       └─ Shutdown workflow helper
```

---

## 🤝 Contributing

1. Fork the repo
2. Create a feature branch: `git checkout -b feature/amazing-feature`
3. Commit: `git commit -m 'Add amazing feature'`
4. Push: `git push origin feature/amazing-feature`
5. Open a Pull Request

---

## 📄 License

GPL-3.0-or-later — see [LICENSE](LICENSE) for details.

---

## 👤 Author

**Komesh Bathula** — [@KomeshBathula](https://github.com/KomeshBathula)

---

> _Built with ❤️ for the Linux community. Because your battery deserves better._
