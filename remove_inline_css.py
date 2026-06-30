import os
import glob
import re

base_dir = r"c:\Users\PC\Pictures\aigeo-main"

# Regex to match from the AIGEO comment block to the closing brace of the media query
# It finds "/* ===...=== */\n   AIGEO CLASSROOMS MOBILE OPTIMIZATION..."
# up to the end of the @media block.
# We'll use a more robust regex that matches the header and then finds the matching closing brace.

pattern = re.compile(
    r'/\*\s*============================================================\s*\n\s*AIGEO CLASSROOMS MOBILE OPTIMIZATION - PROFESSIONAL UI\s*\n\s*============================================================\s*\*/\s*\n\s*@media\s*\(\s*max-width:\s*768px\s*\)\s*\{(?:[^{}]*|\{(?:[^{}]*|\{[^{}]*\})*\})*\}',
    re.MULTILINE
)

count = 0
for filepath in glob.glob(os.path.join(base_dir, 'student', '*.html')):
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()
    
    new_content, num_subs = pattern.subn('', content)
    
    if num_subs > 0:
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(new_content)
        count += 1
        print(f"Removed inline mobile CSS from {filepath}")

print(f"Total files updated: {count}")
