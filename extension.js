import Clutter from 'gi://Clutter';
import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import GObject from 'gi://GObject';
import St from 'gi://St';
import * as PanelMenu from 'resource:///org/gnome/shell/ui/panelMenu.js';
import * as PopupMenu from 'resource:///org/gnome/shell/ui/popupMenu.js';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import { Extension } from 'resource:///org/gnome/shell/extensions/extension.js';
import * as MessageTray from 'resource:///org/gnome/shell/ui/messageTray.js';

let batteryWatcher = null;

const BatteryMenuButton = GObject.registerClass(
class BatteryMenuButton extends PanelMenu.Button {
    _init() {
        super._init(0.0, 'BatteryAlert_Indicator', false);

        this._settings = Extension.lookupByUUID('smart-battery-alert@komesh.dev').getSettings();
        this._indicator = new St.Icon({
            icon_name: 'battery-symbolic',
            style_class: 'system-status-icon'
        });
        this.add_child(this._indicator);

        this._batteryLevelLabel = new St.Label({
            text: 'Battery Level: --%',
            style_class: 'battery-level-label'
        });
        this.add_child(this._batteryLevelLabel);

        this._chargeLimitLabel = new St.Label({
            text: '',
            style_class: 'charge-limit-label'
        });
        this.add_child(this._chargeLimitLabel);

        this._initializeMenu();
        this.initializeTimer();
    }

    _initializeMenu() {
        this._batteryLevelItem = new PopupMenu.PopupMenuItem('Battery Level: --%');
        this.menu.addMenuItem(this._batteryLevelItem);

        this._chargeLimitItem = new PopupMenu.PopupMenuItem(`Charge Limit: ${this._settings.get_int('charge-limit')}%`);
        this.menu.addMenuItem(this._chargeLimitItem);

        this._chargeCompleteByItem = new PopupMenu.PopupMenuItem('Charge Complete By: --');
        this.menu.addMenuItem(this._chargeCompleteByItem);

        this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());

        let refreshButton = new St.Button({
            style_class: 'message-list-clear-button button vitals-button-action',
            child: new St.Icon({ icon_name: 'view-refresh-symbolic' })
        });
        refreshButton.connect('clicked', () => {
            this._queryBattery();
        });

        let refreshMenuItem = new PopupMenu.PopupBaseMenuItem();
        refreshMenuItem.actor.add_child(refreshButton);
        this.menu.addMenuItem(refreshMenuItem);
    }

    initializeTimer() {
        this._refreshTimeoutId = GLib.timeout_add_seconds(
            GLib.PRIORITY_DEFAULT,
            this._settings.get_int('update-time'),
            () => {
                this._queryBattery();
                return GLib.SOURCE_CONTINUE;
            }
        );
    }

    _queryBattery() {
        try {
            let [ok, deviceListRaw] = GLib.spawn_command_line_sync("upower -e");
            if (!ok) {
                logError(new Error("Failed to list battery devices"));
                return;
            }
            let deviceList = new TextDecoder().decode(deviceListRaw).split("\n");
            let batteryDevice = deviceList.find(device => device.includes("BAT"));
            if (!batteryDevice) {
                logError(new Error("Battery device not found"));
                return;
            }
            let [ok2, out] = GLib.spawn_command_line_sync(`upower -i ${batteryDevice}`);
            if (!ok2) {
                logError(new Error("Failed to get battery info"));
                return;
            }
            let info = new TextDecoder().decode(out);
            let percentageMatch = info.match(/percentage:\s+(\d+)%/i);
            let stateMatch = info.match(/state:\s+(\w+)/i);
            let energyRateMatch = info.match(/energy-rate:\s+([\d.]+) W/i);
            let chargeLimit = this._settings.get_int('charge-limit');

            if (!percentageMatch || !stateMatch || !energyRateMatch) {
                log('Battery info incomplete');
                return;
            }

            let percent = parseInt(percentageMatch[1]);
            let state = stateMatch[1];
            let energyRate = parseFloat(energyRateMatch[1]);

            this._updateBatteryLevel(percent);
            this._updateChargeLimit(chargeLimit);
            this._updateChargeCompleteBy(percent, state, energyRate, chargeLimit);
            this._updateBatteryIconVisibility(state);
        } catch (e) {
            logError(e, 'Battery check failed');
        }
    }

    _updateBatteryLevel(percent) {
        this._batteryLevelItem.label.text = `Battery Level: ${percent}%`;
        this._batteryLevelLabel.text = `Battery Level: ${percent}%`;

        if (percent <= 30) {
            Main.notify('Battery Alert', `Battery is at ${percent}%. Connect your charger.`);
        }
        if (percent === 20) {
            const source = new MessageTray.Source('Battery Alert', 'battery-caution-symbolic');
            Main.messageTray.add(source);
            let notification = new MessageTray.Notification(source, 'Critical Battery Alert', 'Battery at 20%! Plug in now.');
            notification.setTransient(false);
            source.showNotification(notification);
        }
    }

    _updateChargeLimit(limit) {
        this._chargeLimitItem.label.text = `Charge Limit: ${limit}%`;
    }

    _updateChargeCompleteBy(percent, state, energyRate, chargeLimit) {
        if (state === 'charging') {
            let estimatedTime = this._estimateChargeCompleteBy(percent, energyRate, chargeLimit);
            this._chargeCompleteByItem.label.text = `Charge Complete By: ${estimatedTime}`;
            this._chargeLimitLabel.text = `Charge Complete By: ${estimatedTime}`;
        } else {
            this._chargeCompleteByItem.label.text = 'Charge Complete By: --';
            this._chargeLimitLabel.text = '';
        }
    }

    _updateBatteryIconVisibility(state) {
        this._indicator.visible = state === 'charging';
    }

    _estimateChargeCompleteBy(currentPercent, energyRate, chargeLimit) {
        // Calculate the time to reach the charge limit based on the current charging rate
        let energyToChargeLimit = (chargeLimit - currentPercent) / 100 * 39.431; // Assuming energy-full is 39.431 Wh
        let timeToLimitHours = energyToChargeLimit / energyRate;
        let now = new Date();
        let future = new Date(now.getTime() + timeToLimitHours * 60 * 60 * 1000);
        return future.toLocaleTimeString();
    }

    destroy() {
        if (this._refreshTimeoutId) {
            GLib.Source.remove(this._refreshTimeoutId);
            this._refreshTimeoutId = null;
        }
        super.destroy();
    }
});

export default class SmartBatteryAlertExtension extends Extension {
    enable() {
        batteryWatcher = new BatteryMenuButton();
        Main.panel.addToStatusArea('battery-watcher', batteryWatcher);
    }

    disable() {
        if (batteryWatcher) {
            batteryWatcher.destroy();
            batteryWatcher = null;
        }
    }
}
