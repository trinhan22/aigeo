import os
import re

filepath = r"c:\Users\PC\Pictures\aigeo-main\student\index.html"

with open(filepath, 'r', encoding='utf-8') as f:
    content = f.read()

# Regex to match the AIGEO STUDENT DASHBOARD MOBILE FIX block
pattern = re.compile(
    r'/\*\s*============================================================\s*\n\s*AIGEO STUDENT DASHBOARD MOBILE FIX - CUỘN & CĂN CHỈNH\s*\n\s*============================================================\s*\*/\s*\n\s*@media\s*\(\s*max-width:\s*768px\s*\)\s*\{(?:[^{}]*|\{(?:[^{}]*|\{[^{}]*\})*\})*\}',
    re.MULTILINE
)

new_content, num_subs = pattern.subn('', content)

if num_subs > 0:
    with open(filepath, 'w', encoding='utf-8') as f:
        f.write(new_content)
    print(f"Removed inline mobile CSS from {filepath}")
else:
    print("Could not find the block!")
