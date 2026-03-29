/*  Smart Battery Alert — Preferences UI
 *  GNOME Shell 45+ ESM format with Adw widgets.
 *
 *  Copyright (c) 2026 Komesh Bathula — komesh.dev
 *  SPDX-License-Identifier: GPL-3.0-or-later
 */

import Adw from 'gi://Adw';
import Gio from 'gi://Gio';
import Gtk from 'gi://Gtk';
import { ExtensionPreferences } from 'resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js';

export default class SmartBatteryAlertPreferences extends ExtensionPreferences {
    fillPreferencesWindow(window) {
        const settings = this.getSettings();

        /* ══ Page ══════════════════════════════════════════════ */
        const page = new Adw.PreferencesPage({
            title: 'Smart Battery Alert',
            icon_name: 'battery-good-symbolic',
        });

        /* ── General ──────────────────────────────────────── */
        const generalGroup = new Adw.PreferencesGroup({
            title: 'General',
            description: 'Basic extension behavior',
        });

        const showPanelPct = new Adw.SwitchRow({
            title: 'Show Battery Percentage',
            subtitle: 'Display percentage next to the icon in the top bar',
        });
        settings.bind('show-panel-percentage', showPanelPct, 'active',
            Gio.SettingsBindFlags.DEFAULT);
        generalGroup.add(showPanelPct);

        const updateTime = new Adw.SpinRow({
            title: 'Fallback Poll Interval',
            subtitle: 'Seconds between fallback polls (primary updates are instant via D-Bus)',
            adjustment: new Gtk.Adjustment({
                lower: 10,
                upper: 120,
                step_increment: 5,
                value: settings.get_int('update-time'),
            }),
        });
        settings.bind('update-time', updateTime, 'value',
            Gio.SettingsBindFlags.DEFAULT);
        generalGroup.add(updateTime);

        page.add(generalGroup);

        /* ── Low Battery Alerts ───────────────────────────── */
        const lowGroup = new Adw.PreferencesGroup({
            title: 'Low Battery Alerts',
            description: 'Notifications when battery is running low',
        });

        const enableLow = new Adw.SwitchRow({
            title: 'Enable Low Battery Alerts',
            subtitle: 'Get notified as battery drops below the threshold',
        });
        settings.bind('enable-low-battery-alarm', enableLow, 'active',
            Gio.SettingsBindFlags.DEFAULT);
        lowGroup.add(enableLow);

        const lowThreshold = new Adw.SpinRow({
            title: 'Low Battery Threshold',
            subtitle: 'Start alerting below this percentage',
            adjustment: new Gtk.Adjustment({
                lower: 15,
                upper: 50,
                step_increment: 1,
                value: settings.get_int('low-battery-threshold'),
            }),
        });
        settings.bind('low-battery-threshold', lowThreshold, 'value',
            Gio.SettingsBindFlags.DEFAULT);
        lowGroup.add(lowThreshold);

        const critThreshold = new Adw.SpinRow({
            title: 'Critical Battery Threshold',
            subtitle: 'Show a persistent alert that blocks the screen at this level',
            adjustment: new Gtk.Adjustment({
                lower: 5,
                upper: 25,
                step_increment: 1,
                value: settings.get_int('critical-battery-threshold'),
            }),
        });
        settings.bind('critical-battery-threshold', critThreshold, 'value',
            Gio.SettingsBindFlags.DEFAULT);
        lowGroup.add(critThreshold);

        const alertInterval = new Adw.SpinRow({
            title: 'Alert Every N%',
            subtitle: 'Notify for every N% decrease below the low threshold',
            adjustment: new Gtk.Adjustment({
                lower: 1,
                upper: 5,
                step_increment: 1,
                value: settings.get_int('low-battery-alert-interval'),
            }),
        });
        settings.bind('low-battery-alert-interval', alertInterval, 'value',
            Gio.SettingsBindFlags.DEFAULT);
        lowGroup.add(alertInterval);

        page.add(lowGroup);

        /* ── Charge Limit ─────────────────────────────────── */
        const limitGroup = new Adw.PreferencesGroup({
            title: 'Charge Limit Alarm',
            description: 'Protect your Li-ion battery by getting alerted at a set charge level',
        });

        const enableLimit = new Adw.SwitchRow({
            title: 'Enable Charge Limit Alarm',
            subtitle: 'Alert when battery reaches the configured limit while charging',
        });
        settings.bind('enable-charge-limit-alarm', enableLimit, 'active',
            Gio.SettingsBindFlags.DEFAULT);
        limitGroup.add(enableLimit);

        const chargeLimit = new Adw.SpinRow({
            title: 'Charge Limit',
            subtitle: 'Get alerted when battery reaches this percentage',
            adjustment: new Gtk.Adjustment({
                lower: 60,
                upper: 100,
                step_increment: 1,
                value: settings.get_int('charge-limit'),
            }),
        });
        settings.bind('charge-limit', chargeLimit, 'value',
            Gio.SettingsBindFlags.DEFAULT);
        limitGroup.add(chargeLimit);

        /* Quick-set action rows */
        for (let pct of [70, 80, 90]) {
            const row = new Adw.ActionRow({
                title: `Quick Set: ${pct}%`,
                subtitle: pct === 80
                    ? 'Recommended for daily use (best battery longevity)'
                    : pct === 70
                        ? 'Conservative — maximum battery lifespan'
                        : 'Balanced — more capacity per charge',
                activatable: true,
            });
            row.add_suffix(new Gtk.Image({
                icon_name: settings.get_int('charge-limit') === pct
                    ? 'emblem-ok-symbolic'
                    : 'go-next-symbolic',
            }));
            row.connect('activated', () => {
                settings.set_int('charge-limit', pct);
                chargeLimit.adjustment.value = pct;
                /* Note: icon won't live-update here but it's fine for a prefs window */
            });
            limitGroup.add(row);
        }

        page.add(limitGroup);

        /* ── Charge Prediction ────────────────────────────── */
        const predGroup = new Adw.PreferencesGroup({
            title: 'Charge Time Prediction',
            description: 'Estimate when your laptop will be fully charged',
        });

        const enablePred = new Adw.SwitchRow({
            title: 'Enable Charge Prediction',
            subtitle: 'Show estimated completion time when charger is connected',
        });
        settings.bind('enable-charge-prediction', enablePred, 'active',
            Gio.SettingsBindFlags.DEFAULT);
        predGroup.add(enablePred);

        const infoRow = new Adw.ActionRow({
            title: '💡 Shutdown Tip',
            subtitle: 'When charging, the popup menu shows the exact time your battery will reach the limit. Set a phone alarm for that time, then shut down safely.',
        });
        predGroup.add(infoRow);

        page.add(predGroup);

        /* ── About ────────────────────────────────────────── */
        const aboutGroup = new Adw.PreferencesGroup({
            title: 'About',
        });

        const aboutRow = new Adw.ActionRow({
            title: 'Smart Battery Alert',
            subtitle: 'v2.0 — by Komesh Bathula\nLightweight • Non-invasive • Works on all Linux distros',
        });
        aboutRow.add_prefix(new Gtk.Image({
            icon_name: 'battery-good-symbolic',
            pixel_size: 32,
        }));
        aboutGroup.add(aboutRow);

        page.add(aboutGroup);

        window.add(page);
    }
}
