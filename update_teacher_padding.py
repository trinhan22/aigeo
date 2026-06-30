import os
import glob

base_dir = r"c:\Users\PC\Pictures\aigeo-main\teacher"

count = 0
for filepath in glob.glob(os.path.join(base_dir, '*.html')):
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()
    
    # Replace the main container padding
    new_content = content.replace('class="flex-1 overflow-y-auto p-8"', 'class="flex-1 overflow-y-auto p-4 md:p-8"')
    new_content = new_content.replace('class="flex-1 overflow-y-auto bg-slate-50/50 p-8"', 'class="flex-1 overflow-y-auto bg-slate-50/50 p-4 md:p-8"')
    new_content = new_content.replace('class="flex-1 overflow-x-hidden overflow-y-auto bg-slate-50/50 p-8"', 'class="flex-1 overflow-x-hidden overflow-y-auto bg-slate-50/50 p-4 md:p-8"')
    
    if new_content != content:
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(new_content)
        count += 1
        print(f"Updated padding in {os.path.basename(filepath)}")

print(f"Total files updated padding: {count}")
