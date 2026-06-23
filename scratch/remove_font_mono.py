import re
import sys

def clean_file(filepath):
    with open(filepath, 'r') as f:
        content = f.read()

    # Replace occurrences like "font-mono " or " font-mono" or "font-mono"
    # Handling both standard classes and string interpolation classes
    cleaned = re.sub(r'\bfont-mono\s*', '', content)
    # Also clean up double spaces inside class lists
    cleaned = re.sub(r'\s{2,}', ' ', cleaned)
    # But wait, we don't want to mess up indentation!
    # Let's target class names more safely by replacing the exact classes:
    # "font-mono text-slate-400 text-xs" -> "text-slate-400 text-xs", etc.
    # Actually, using simple string replacements for the exact elements is very safe.

    # Let's do a basic regex match that only targets class lists or className values.
    # We can search for font-mono and just replace it with empty string, then strip double spaces.
    content = content.replace('font-mono ', '').replace(' font-mono', '').replace('font-mono', '')

    with open(filepath, 'w') as f:
        f.write(content)
    print(f"Cleaned {filepath}")

if __name__ == '__main__':
    if len(sys.argv) > 1:
        clean_file(sys.argv[1])
