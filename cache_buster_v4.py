import os
import glob

base_dir = r"c:\Users\PC\Pictures\aigeo-main"

count = 0
for filepath in glob.glob(os.path.join(base_dir, '**', '*.html'), recursive=True):
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()
    
    # Replace v=3 with v=4
    new_content = content.replace('href="../global-responsive.css?v=3"', 'href="../global-responsive.css?v=4"')
    new_content = new_content.replace('href="global-responsive.css?v=3"', 'href="global-responsive.css?v=4"')
    
    # If the file had the old link, write it back
    if new_content != content:
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(new_content)
        count += 1

print(f"Total files updated with cache buster v4: {count}")
