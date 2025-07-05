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

        this._chargingTimeLabel = new St.Label({
            text: '',
            style_class: 'charging-time-label'
        });
        this.add_child(this._chargingTimeLabel);

        this._initializeMenu();
        this._initializeTimer();
    }

    _initializeMenu() {
        this._batteryLevelItem = new PopupMenu.PopupMenuItem('Battery Level: --%');
        this.menu.addMenuItem(this._batteryLevelItem);

        this._chargingTimeItem = new PopupMenu.PopupMenuItem('Charging Time: --');
        this.menu.addMenuItem(this._chargingTimeItem);

        this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());

        let chargeLimitItem = new PopupMenu.PopupMenuItem('Set Charge Limit: 80%');
        this.menu.addMenuItem(chargeLimitItem);

        let refreshButton = new St.Button({
            style_class: 'message-list-clear-button button vitals-button-action',
            child: new St.Icon({ icon_name: 'view-refresh-symbolic' })
        });
        refreshButton.connect('clicked', () => this._queryBattery());

        let refreshMenuItem = new PopupMenu.PopupBaseMenuItem();
        refreshMenuItem.actor.add_child(refreshButton);
        this.menu.addMenuItem(refreshMenuItem);
    }

    _initializeTimer() {
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
            let [ok, out] = GLib.spawn_command_line_sync("upower -i $(upower -e | grep BAT)");
            if (!ok) throw new Error('Failed to get battery info');

            let info = new TextDecoder().decode(out);
            let percentageMatch = info.match(/percentage:\s+(\d+)%/);
            let stateMatch = info.match(/state:\s+(\w+)/);

            if (!percentageMatch || !stateMatch) return;

            let percent = parseInt(percentageMatch[1]);
            let state = stateMatch[1];

            this._updateBatteryLevel(percent);
            this._updateChargingTime(percent, state);
            this._updateBatteryIconVisibility(state);
        } catch (e) {
            logError(e, 'Battery check failed');
        }
    }

    _updateBatteryLevel(percent) {
        this._batteryLevelItem.label.text = `Battery Level: ${percent}%`;

        if (percent <= 30) {
            Main.notify('Battery Alert', `Battery is at ${percent}%. Connect your charger.`);
        }
        if (percent === 20) {
            let notification = new MessageTray.Notification('Critical Battery Alert', 'Battery at 20%! Plug in now.');
            notification.setTransient(false);
            Main.messageTray.add(notification);
        }
    }

    _updateChargingTime(percent, state) {
        if (state === 'charging') {
            let estimatedTime = this._estimateChargingTime(percent);
            this._chargingTimeItem.label.text = `Charging Time: ${estimatedTime}`;
            this._chargingTimeLabel.text = estimatedTime;
        } else {
            this._chargingTimeItem.label.text = 'Charging Time: --';
            this._chargingTimeLabel.text = '';
        }
    }

    _updateBatteryIconVisibility(state) {
        this._indicator.visible = state === 'charging';
    }

    _estimateChargingTime(percent) {
        let currentTime = new Date();
        let estimatedCompletionTime = new Date(currentTime.getTime() + 2 * 60 * 60 * 1000);
        return estimatedCompletionTime.toLocaleTimeString();
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
