import Adw from 'gi://Adw';
import Gio from 'gi://Gio';
import GObject from 'gi://GObject';
import Gtk from 'gi://Gtk';
import { ExtensionPreferences } from 'resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js';

export default class SmartBatteryAlertPreferences extends ExtensionPreferences {
    fillPreferencesWindow(window) {
        const settings = this.getSettings();

        const page = new Adw.PreferencesPage();
        const group = new Adw.PreferencesGroup();
        //Update Time Row 
        const updateTimeRow = new Adw.SpinRow({
            title: 'Update Time',
            subtitle: 'Seconds between updates',
            adjustment: new Gtk.Adjustment({
                lower: 1,
                upper: 60,
                step_increment: 1,
            }),
        });
        settings.bind('update-time', updateTimeRow, 'value', Gio.SettingsBindFlags.DEFAULT);
        group.add(updateTimeRow);

        const chargeLimitRow = new Adw.SpinRow({
            title: 'Charge Limit',
            subtitle: 'Set battery charge limit',
            adjustment: new Gtk.Adjustment({
                lower: 70,
                upper: 100,
                step_increment: 1,
            }),
        });
        settings.bind('charge-limit', chargeLimitRow, 'value', Gio.SettingsBindFlags.DEFAULT);
        group.add(chargeLimitRow);

        page.add(group);
        window.add(page);
    }
}

