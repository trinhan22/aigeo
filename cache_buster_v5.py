import os
import glob

base_dir = r"c:\Users\PC\Pictures\aigeo-main"

count = 0
for filepath in glob.glob(os.path.join(base_dir, '**', '*.html'), recursive=True):
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()
    
    # Replace v=4 with v=5
    new_content = content.replace('href="../global-responsive.css?v=4"', 'href="../global-responsive.css?v=5"')
    new_content = new_content.replace('href="global-responsive.css?v=4"', 'href="global-responsive.css?v=5"')
    
    if new_content != content:
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(new_content)
        count += 1

print(f"Total files updated with cache buster v5: {count}")
