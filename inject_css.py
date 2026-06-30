import os
import glob

# Path to the workspace
base_dir = r"c:\Users\PC\Pictures\aigeo-main"
css_file = "global-responsive.css"

def inject_css_to_file(filepath):
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()

    # Calculate relative depth to the base_dir
    rel_path = os.path.relpath(filepath, base_dir)
    depth = rel_path.count(os.sep)
    
    if depth == 0:
        css_path = f"./{css_file}"
    else:
        css_path = "../" * depth + css_file

    link_tag = f'\n    <link rel="stylesheet" href="{css_path}">\n'

    # Check if already injected
    if css_file in content:
        print(f"Skipping (already injected): {filepath}")
        return

    # Find the closing </head> tag (case insensitive-ish, or just </head>)
    head_close_idx = content.lower().find("</head>")
    
    if head_close_idx != -1:
        new_content = content[:head_close_idx] + link_tag + content[head_close_idx:]
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(new_content)
        print(f"Injected into: {filepath}")
    else:
        print(f"Warning: No </head> tag found in {filepath}")

def main():
    # Find all html files recursively
    html_files = glob.glob(os.path.join(base_dir, "**/*.html"), recursive=True)
    
    for html_file in html_files:
        inject_css_to_file(html_file)

if __name__ == "__main__":
    main()
