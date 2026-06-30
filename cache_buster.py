import os
import glob

base_dir = r"c:\Users\PC\Pictures\aigeo-main"

count = 0
for filepath in glob.glob(os.path.join(base_dir, '**', '*.html'), recursive=True):
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()
    
    # Replace the old link with the versioned link
    new_content = content.replace('href="../global-responsive.css"', 'href="../global-responsive.css?v=2"')
    
    # If the file had the old link, write it back
    if new_content != content:
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(new_content)
        count += 1
        print(f"Updated cache buster in {filepath}")

print(f"Total files updated: {count}")
