UUID = smart-battery-alert@komesh.dev
INSTALL_DIR = $(HOME)/.local/share/gnome-shell/extensions/$(UUID)

.PHONY: install uninstall schemas clean

schemas:
	glib-compile-schemas schemas/

install: schemas
	mkdir -p $(INSTALL_DIR)
	cp -r extension.js prefs.js metadata.json stylesheet.css schemas/ $(INSTALL_DIR)/
	@echo ""
	@echo "✅ Installed to $(INSTALL_DIR)"
	@echo ""
	@echo "Next steps:"
	@echo "  • Wayland: Log out → log in"
	@echo "  • X11:     Alt+F2 → r → Enter"
	@echo "  • Then:    gnome-extensions enable $(UUID)"
	@echo ""

uninstall:
	rm -rf $(INSTALL_DIR)
	@echo "🗑️  Uninstalled $(UUID)"

clean:
	rm -f schemas/gschemas.compiled
