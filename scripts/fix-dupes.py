with open(r'\\LELYNAS\trackandtide\index.html', 'r', encoding='utf-8') as f:
    content = f.read()

# Fix ALL .trackMap( occurrences (they should be .map()
count = content.count('.trackMap(')
content = content.replace('.trackMap(', '.map(')
print(f'Fixed {count} corrupted .map() calls')

with open(r'\\LELYNAS\trackandtide\index.html', 'w', encoding='utf-8') as f:
    f.write(content)
print('Done')

