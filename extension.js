/*  Smart Battery Alert — GNOME Shell Extension
 *  Lightweight, event-driven battery monitor.
 *  Works on all Linux distros with UPower (Fedora, Ubuntu, Arch, etc.)
 *  Supports GNOME Shell 43 – 48.
 *
 *  Copyright (c) 2026 Komesh Bathula — komesh.dev
 *  SPDX-License-Identifier: GPL-3.0-or-later
 */

import Clutter from 'gi://Clutter';
import GLib from 'gi://GLib';
import GObject from 'gi://GObject';
import St from 'gi://St';
import UPowerGlib from 'gi://UPowerGlib';

import * as PanelMenu from 'resource:///org/gnome/shell/ui/panelMenu.js';
import * as PopupMenu from 'resource:///org/gnome/shell/ui/popupMenu.js';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import * as ModalDialog from 'resource:///org/gnome/shell/ui/modalDialog.js';
import { Extension } from 'resource:///org/gnome/shell/extensions/extension.js';

/* ── UPower battery states ─────────────────────────────────── */
const UPOWER_STATE_CHARGING    = 1;
const UPOWER_STATE_DISCHARGING = 2;
const UPOWER_STATE_EMPTY       = 3;
const UPOWER_STATE_FULL        = 4;
const UPOWER_STATE_PENDING_CHARGE   = 5;
const UPOWER_STATE_PENDING_DISCHARGE = 6;

/* ── Helpers ───────────────────────────────────────────────── */

/**
 * Format a Date as a user-friendly clock string.
 * e.g. "12:15 PM"  or  "08:30 AM"
 */
function _formatClockTime(date) {
    let hours   = date.getHours();
    let minutes = date.getMinutes();
    let ampm    = hours >= 12 ? 'PM' : 'AM';
    hours = hours % 12 || 12;
    let mm = minutes < 10 ? `0${minutes}` : `${minutes}`;
    return `${hours}:${mm} ${ampm}`;
}

/**
 * Show a simple notification. Works across GNOME 43 – 48.
 */
function _notify(title, body) {
    Main.notify(title, body);
}

/**
 * Pick the right battery icon name based on percentage and state.
 */
function _batteryIconName(percent, isCharging) {
    let level;
    if (percent >= 90)      level = 'full';
    else if (percent >= 50) level = 'good';
    else if (percent >= 20) level = 'low';
    else if (percent >= 5)  level = 'caution';
    else                    level = 'empty';

    return isCharging
        ? `battery-${level}-charging-symbolic`
        : `battery-${level}-symbolic`;
}


/* ═══════════════════════════════════════════════════════════════
   CriticalBatteryDialog
   A modal dialog that blocks the desktop until charger is connected.
   ═══════════════════════════════════════════════════════════════ */
const CriticalBatteryDialog = GObject.registerClass(
class CriticalBatteryDialog extends ModalDialog.ModalDialog {
    _init(getStateCallback) {
        super._init({ styleClass: 'sba-critical-dialog' });

        this._getState = getStateCallback;
        this._dismissed = false;

        /* ── Content ──────────────────────────────────────── */
        let box = new St.BoxLayout({
            vertical: true,
            x_align: Clutter.ActorAlign.CENTER,
            style_class: 'sba-critical-content',
        });

        let icon = new St.Icon({
            icon_name: 'battery-empty-symbolic',
            icon_size: 64,
            style_class: 'sba-critical-icon',
        });
        box.add_child(icon);

        let title = new St.Label({
            text: '⚠️  Critical Battery',
            style_class: 'sba-critical-title',
            x_align: Clutter.ActorAlign.CENTER,
        });
        box.add_child(title);

        this._bodyLabel = new St.Label({
            text: 'Battery is critically low!\nConnect your charger immediately.',
            style_class: 'sba-critical-body',
            x_align: Clutter.ActorAlign.CENTER,
        });
        box.add_child(this._bodyLabel);

        this.contentLayout.add_child(box);

        /* ── Button ───────────────────────────────────────── */
        this.addButton({
            label: "I've connected the charger",
            action: () => this._onCheckCharger(),
            key: Clutter.KEY_Return,
        });
    }

    _onCheckCharger() {
        let state = this._getState();
        if (state === UPOWER_STATE_CHARGING ||
            state === UPOWER_STATE_FULL ||
            state === UPOWER_STATE_PENDING_CHARGE) {
            this._dismissed = true;
            this.close();
        } else {
            this._bodyLabel.text =
                'Charger NOT detected!\nPlease plug in your charger and try again.';
        }
    }

    get wasDismissed() { return this._dismissed; }
});


/* ═══════════════════════════════════════════════════════════════
   SmartBatteryIndicator
   Panel indicator + popup menu.
   ═══════════════════════════════════════════════════════════════ */
const SmartBatteryIndicator = GObject.registerClass(
class SmartBatteryIndicator extends PanelMenu.Button {

    _init(settings) {
        super._init(0.0, 'SmartBatteryAlert_Indicator', false);

        this._settings = settings;

        /* ── Top-bar widgets (icon + label) ────────────────── */
        let panelBox = new St.BoxLayout({ style_class: 'panel-status-indicators-box' });

        this._icon = new St.Icon({
            icon_name: 'battery-good-symbolic',
            style_class: 'system-status-icon',
        });
        panelBox.add_child(this._icon);

        this._panelLabel = new St.Label({
            text: '',
            y_align: Clutter.ActorAlign.CENTER,
            style_class: 'sba-panel-label',
        });
        panelBox.add_child(this._panelLabel);
        this.add_child(panelBox);

        /* ── Popup menu ────────────────────────────────────── */
        this._buildMenu();
    }

    _buildMenu() {
        /* Header */
        this._headerItem = new PopupMenu.PopupMenuItem('Smart Battery Alert', {
            reactive: false,
        });
        this._headerItem.add_style_class_name('sba-menu-header');
        this.menu.addMenuItem(this._headerItem);
        this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());

        /* Battery level */
        this._levelItem = new PopupMenu.PopupMenuItem('Battery: --%');
        this._levelItem.setSensitive(false);
        this.menu.addMenuItem(this._levelItem);

        /* State */
        this._stateItem = new PopupMenu.PopupMenuItem('Status: --');
        this._stateItem.setSensitive(false);
        this.menu.addMenuItem(this._stateItem);

        /* Charge ETA */
        this._etaItem = new PopupMenu.PopupMenuItem('Charge complete by: --');
        this._etaItem.setSensitive(false);
        this.menu.addMenuItem(this._etaItem);

        /* Charge limit display */
        this._limitDisplayItem = new PopupMenu.PopupMenuItem(
            `Charge limit: ${this._settings.get_int('charge-limit')}%`
        );
        this._limitDisplayItem.setSensitive(false);
        this.menu.addMenuItem(this._limitDisplayItem);

        this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());

        /* ── Quick-set charge limit buttons ────────────────── */
        let quickSetLabel = new PopupMenu.PopupMenuItem('Set charge limit:', {
            reactive: false,
        });
        quickSetLabel.add_style_class_name('sba-quickset-header');
        this.menu.addMenuItem(quickSetLabel);

        let buttonItem = new PopupMenu.PopupBaseMenuItem({ reactive: false });
        let btnBox = new St.BoxLayout({
            style_class: 'sba-quickset-box',
            x_expand: true,
        });

        this._quickBtns = {};
        for (let pct of [70, 80, 90]) {
            let btn = new St.Button({
                label: `${pct}%`,
                style_class: 'sba-quickset-btn',
                x_expand: true,
            });
            btn.connect('clicked', () => {
                this._settings.set_int('charge-limit', pct);
                this._updateQuickBtnStates(pct);
                this._limitDisplayItem.label.text = `Charge limit: ${pct}%`;
            });
            btnBox.add_child(btn);
            this._quickBtns[pct] = btn;
        }

        // PopupBaseMenuItem: use add_child (GNOME 44+) with fallback to actor.add_child
        try {
            buttonItem.add_child(btnBox);
        } catch (_e) {
            buttonItem.actor.add_child(btnBox);
        }
        this.menu.addMenuItem(buttonItem);

        this._updateQuickBtnStates(this._settings.get_int('charge-limit'));

        this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());

        /* ── Shutdown helper message ───────────────────────── */
        this._shutdownItem = new PopupMenu.PopupMenuItem('', {
            reactive: false,
        });
        this._shutdownItem.add_style_class_name('sba-shutdown-msg');
        this._setItemVisible(this._shutdownItem, false);
        this.menu.addMenuItem(this._shutdownItem);
    }

    /**
     * Cross-version visibility setter for PopupMenuItems.
     * In GNOME 44+, the item IS the actor.
     * In GNOME 43, you access .actor.
     */
    _setItemVisible(item, visible) {
        if (item.visible !== undefined) {
            item.visible = visible;
        } else if (item.actor) {
            item.actor.visible = visible;
        }
    }

    _updateQuickBtnStates(activeLimit) {
        for (let pct in this._quickBtns) {
            if (parseInt(pct) === activeLimit)
                this._quickBtns[pct].add_style_class_name('sba-quickset-active');
            else
                this._quickBtns[pct].remove_style_class_name('sba-quickset-active');
        }
    }

    /* ── Public update methods ──────────────────────────────── */

    updateBattery(percent, state, eta) {
        let isCharging = (state === UPOWER_STATE_CHARGING);
        let isFull     = (state === UPOWER_STATE_FULL);

        /* Icon */
        this._icon.icon_name = _batteryIconName(percent, isCharging);

        /* Panel label */
        let showPct = this._settings.get_boolean('show-panel-percentage');
        if (showPct) {
            if (isCharging && eta)
                this._panelLabel.text = `${percent}% → ${eta}`;
            else
                this._panelLabel.text = `${percent}%`;
        } else {
            this._panelLabel.text = '';
        }

        /* Menu items */
        this._levelItem.label.text = `Battery: ${percent}%`;

        if (isCharging)       this._stateItem.label.text = 'Status: ⚡ Charging';
        else if (isFull)      this._stateItem.label.text = 'Status: ✅ Fully charged';
        else                  this._stateItem.label.text = 'Status: 🔋 On battery';

        if (isCharging && eta) {
            this._etaItem.label.text = `Charged by: ${eta}`;
            this._setItemVisible(this._etaItem, true);
        } else {
            this._etaItem.label.text = 'Charge complete by: --';
            this._setItemVisible(this._etaItem, isCharging);
        }

        /* Charge limit */
        let limit = this._settings.get_int('charge-limit');
        this._limitDisplayItem.label.text = `Charge limit: ${limit}%`;
        this._updateQuickBtnStates(limit);

        /* Shutdown helper */
        if (isCharging && eta) {
            this._shutdownItem.label.text =
                `📱 Shutting down? Set a phone alarm\nfor ${eta}, then shutdown safely.`;
            this._setItemVisible(this._shutdownItem, true);
        } else {
            this._setItemVisible(this._shutdownItem, false);
        }
    }
});


/* ═══════════════════════════════════════════════════════════════
   BatteryMonitor
   Core event-driven monitoring engine.
   ═══════════════════════════════════════════════════════════════ */
class BatteryMonitor {
    constructor(settings) {
        this._settings = settings;
        this._destroyed = false;

        /* State */
        this._percent = -1;
        this._batteryState = -1;
        this._energyRate = 0;
        this._energyFull = 0;
        this._energy = 0;

        /* Alert tracking */
        this._lastAlertedPercent = this._settings.get_int('low-battery-threshold');
        this._chargeLimitReached = false;
        this._chargerNotified = false;
        this._criticalDialog = null;
        this._lastOverChargeAlertPct = -1;

        /* Charge prediction: exponential moving average */
        this._energyRateEMA = 0;
        this._emaAlpha = 0.3;

        /* UPower client */
        this._upClient = UPowerGlib.Client.new();
        this._device = null;
        this._deviceSignalId = null;

        /* Timer IDs for cleanup */
        this._fallbackTimerId = null;
        this._chargerNotifyTimerId = null;
        this._retryTimerId = null;

        this._findBattery();
    }

    /* ── Find battery device ───────────────────────────────── */
    _findBattery() {
        if (this._destroyed) return;

        let devices = this._upClient.get_devices();
        for (let dev of devices) {
            if (dev.kind === UPowerGlib.DeviceKind.BATTERY) {
                this._device = dev;
                break;
            }
        }

        if (!this._device) {
            log('[SmartBatteryAlert] No battery device found. Retrying in 10s…');
            this._retryTimerId = GLib.timeout_add_seconds(
                GLib.PRIORITY_DEFAULT, 10, () => {
                    this._retryTimerId = null;
                    this._findBattery();
                    return GLib.SOURCE_REMOVE;
                }
            );
            return;
        }

        /* Connect to property changes (event-driven – zero CPU when idle) */
        this._deviceSignalId = this._device.connect('notify', (_dev, _pspec) => {
            if (!this._destroyed)
                this._onDeviceChanged();
        });

        /* Initial read */
        this._onDeviceChanged();

        /* Fallback timer for edge cases where D-Bus signals might be missed */
        let interval = this._settings.get_int('update-time');
        this._fallbackTimerId = GLib.timeout_add_seconds(
            GLib.PRIORITY_DEFAULT, interval, () => {
                if (this._destroyed) return GLib.SOURCE_REMOVE;
                this._onDeviceChanged();
                return GLib.SOURCE_CONTINUE;
            }
        );
    }

    /* ── Device property changed ───────────────────────────── */
    _onDeviceChanged() {
        if (!this._device || this._destroyed) return;

        let percent     = Math.round(this._device.percentage);
        let state       = this._device.state;
        let energyRate  = this._device.energy_rate;
        let energyFull  = this._device.energy_full;
        let energy      = this._device.energy;

        let prevState = this._batteryState;
        this._percent     = percent;
        this._batteryState = state;
        this._energyRate  = energyRate;
        this._energyFull  = energyFull;
        this._energy      = energy;

        /* Update exponential moving average of energy rate */
        if (energyRate > 0) {
            if (this._energyRateEMA <= 0)
                this._energyRateEMA = energyRate;
            else
                this._energyRateEMA =
                    this._emaAlpha * energyRate + (1 - this._emaAlpha) * this._energyRateEMA;
        }

        let isCharging = (state === UPOWER_STATE_CHARGING);

        /* ── State transition: just plugged in ─────────────── */
        if (isCharging && prevState !== UPOWER_STATE_CHARGING && prevState !== -1) {
            this._onChargerConnected(percent);
        }

        /* ── State transition: just unplugged ──────────────── */
        if (!isCharging && prevState === UPOWER_STATE_CHARGING) {
            this._onChargerDisconnected();
        }

        /* ── Charging logic ────────────────────────────────── */
        if (isCharging) {
            this._handleCharging(percent);
        }

        /* ── Discharging logic ─────────────────────────────── */
        if (state === UPOWER_STATE_DISCHARGING) {
            this._handleDischarging(percent);
        }

        /* ── Auto-dismiss critical dialog when charger connects */
        if (this._criticalDialog && !this._criticalDialog.wasDismissed && isCharging) {
            try { this._criticalDialog.close(); } catch (_e) { /* already closed */ }
            this._criticalDialog = null;
        }

        /* ── Update indicator ──────────────────────────────── */
        let eta = this._getChargeETA(percent);
        if (this._indicator)
            this._indicator.updateBattery(percent, state, eta);
    }

    /* ── Charger connected ─────────────────────────────────── */
    _onChargerConnected(_percent) {
        this._chargerNotified = false;
        this._chargeLimitReached = false;
        this._lastOverChargeAlertPct = -1;
        this._energyRateEMA = 0;  // reset EMA for fresh readings
        this._lastAlertedPercent = this._settings.get_int('low-battery-threshold');

        if (!this._settings.get_boolean('enable-charge-prediction')) return;

        // Cancel any pending notification timer
        if (this._chargerNotifyTimerId) {
            GLib.Source.remove(this._chargerNotifyTimerId);
            this._chargerNotifyTimerId = null;
        }

        // Notify after a short delay to get a stable ETA reading
        this._chargerNotifyTimerId = GLib.timeout_add_seconds(
            GLib.PRIORITY_DEFAULT, 5, () => {
                this._chargerNotifyTimerId = null;
                if (this._destroyed) return GLib.SOURCE_REMOVE;

                if (this._batteryState === UPOWER_STATE_CHARGING && !this._chargerNotified) {
                    let eta = this._getChargeETA(this._percent);
                    if (eta) {
                        _notify(
                            '⚡ Charger Connected',
                            `Your laptop will be charged by ${eta}.\n📱 Set a phone alarm for ${eta} if you plan to shut down.`
                        );
                        this._chargerNotified = true;
                    }
                }
                return GLib.SOURCE_REMOVE;
            }
        );
    }

    /* ── Charger disconnected ──────────────────────────────── */
    _onChargerDisconnected() {
        this._chargerNotified = false;
        this._chargeLimitReached = false;
        this._lastOverChargeAlertPct = -1;

        // Cancel pending charger notification
        if (this._chargerNotifyTimerId) {
            GLib.Source.remove(this._chargerNotifyTimerId);
            this._chargerNotifyTimerId = null;
        }
    }

    /* ── Handle charging state ─────────────────────────────── */
    _handleCharging(percent) {
        if (!this._settings.get_boolean('enable-charge-limit-alarm')) return;

        let limit = this._settings.get_int('charge-limit');

        /* Charge limit reached */
        if (percent >= limit && !this._chargeLimitReached) {
            this._chargeLimitReached = true;
            _notify(
                '🔋 Charge Limit Reached',
                `Battery is at ${percent}%. You set a limit of ${limit}%.\nPlease unplug the charger to protect battery health.`
            );
            this._lastOverChargeAlertPct = percent;
        }

        /* Over-charge alerts: every 1% beyond limit */
        if (this._chargeLimitReached && percent > limit &&
            percent !== this._lastOverChargeAlertPct) {
            _notify(
                '⚠️ Over-Charging!',
                `Battery is at ${percent}% — ${percent - limit}% beyond your ${limit}% limit.\nRemove the charger now!`
            );
            this._lastOverChargeAlertPct = percent;
        }
    }

    /* ── Handle discharging state ──────────────────────────── */
    _handleDischarging(percent) {
        if (!this._settings.get_boolean('enable-low-battery-alarm')) return;

        let lowThreshold      = this._settings.get_int('low-battery-threshold');
        let criticalThreshold = this._settings.get_int('critical-battery-threshold');
        let alertInterval     = this._settings.get_int('low-battery-alert-interval');

        /* Low battery alerts (between lowThreshold and criticalThreshold) */
        if (percent <= lowThreshold && percent > criticalThreshold) {
            if (percent <= this._lastAlertedPercent - alertInterval) {
                _notify(
                    '🔋 Low Battery',
                    `Battery is at ${percent}%. Connect your charger.`
                );
                this._lastAlertedPercent = percent;
            }
        }

        /* Critical battery — persistent modal */
        if (percent <= criticalThreshold) {
            /* Still send a notification for each alertInterval% drop */
            if (percent <= this._lastAlertedPercent - alertInterval) {
                _notify(
                    '🚨 Critical Battery!',
                    `Battery at ${percent}%! Connect charger NOW!`
                );
                this._lastAlertedPercent = percent;
            }

            /* Show modal dialog if not already showing */
            if (!this._criticalDialog) {
                this._criticalDialog = new CriticalBatteryDialog(
                    () => this._batteryState
                );
                this._criticalDialog.open();
            }
        }
    }

    /* ── Charge ETA calculation ─────────────────────────────── */
    _getChargeETA(currentPercent) {
        if (this._batteryState !== UPOWER_STATE_CHARGING) return null;
        if (!this._settings.get_boolean('enable-charge-prediction')) return null;

        let rate = this._energyRateEMA > 0 ? this._energyRateEMA : this._energyRate;
        if (rate <= 0) return null;

        let limit = this._settings.get_int('charge-limit');
        let targetPercent = Math.min(limit, 100);
        if (currentPercent >= targetPercent) return null;

        let energyNeeded = (targetPercent - currentPercent) / 100 * this._energyFull;
        let hoursToCharge = energyNeeded / rate;

        // Sanity cap: > 12 hours likely means bad sensor data
        if (hoursToCharge > 12 || hoursToCharge < 0) return null;

        let now = new Date();
        let future = new Date(now.getTime() + hoursToCharge * 3600000);
        return _formatClockTime(future);
    }

    /* ── Attach indicator reference ────────────────────────── */
    setIndicator(indicator) {
        this._indicator = indicator;
        // Fire an immediate update
        this._onDeviceChanged();
    }

    /* ── Cleanup ───────────────────────────────────────────── */
    destroy() {
        this._destroyed = true;

        if (this._fallbackTimerId) {
            GLib.Source.remove(this._fallbackTimerId);
            this._fallbackTimerId = null;
        }

        if (this._retryTimerId) {
            GLib.Source.remove(this._retryTimerId);
            this._retryTimerId = null;
        }

        if (this._chargerNotifyTimerId) {
            GLib.Source.remove(this._chargerNotifyTimerId);
            this._chargerNotifyTimerId = null;
        }

        if (this._device && this._deviceSignalId) {
            this._device.disconnect(this._deviceSignalId);
            this._deviceSignalId = null;
        }

        if (this._criticalDialog) {
            try { this._criticalDialog.close(); } catch (_e) {}
            this._criticalDialog = null;
        }

        this._device = null;
        this._upClient = null;
        this._indicator = null;
    }
}


/* ═══════════════════════════════════════════════════════════════
   Extension entry point
   ═══════════════════════════════════════════════════════════════ */
export default class SmartBatteryAlertExtension extends Extension {
    enable() {
        this._settings = this.getSettings();

        /* Create monitor (event-driven core) */
        this._monitor = new BatteryMonitor(this._settings);

        /* Create panel indicator */
        this._indicator = new SmartBatteryIndicator(this._settings);
        Main.panel.addToStatusArea('smart-battery-alert', this._indicator);

        /* Link them */
        this._monitor.setIndicator(this._indicator);
    }

    disable() {
        if (this._monitor) {
            this._monitor.destroy();
            this._monitor = null;
        }

        if (this._indicator) {
            this._indicator.destroy();
            this._indicator = null;
        }

        this._settings = null;
    }
}
