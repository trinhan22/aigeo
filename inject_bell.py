import os
import glob
import re

files = glob.glob('**/*.html', recursive=True)
count = 0

for f in files:
    with open(f, 'r', encoding='utf-8') as file:
        content = file.read()
    
    # If the file has the user avatar section but missing the bell
    if 'global-notification-bell' not in content and 'class="text-right hidden sm:block"' in content:
        # Inject the bell right before the <div class="text-right hidden sm:block">
        new_content = content.replace(
            '<div class="text-right hidden sm:block">',
            '<div id="global-notification-bell" class="mr-2 sm:mr-4 z-50"></div>\n                <div class="text-right hidden sm:block">'
        )
        
        with open(f, 'w', encoding='utf-8') as file:
            file.write(new_content)
        count += 1
        print(f"Updated {f}")

print(f"Total updated: {count}")
