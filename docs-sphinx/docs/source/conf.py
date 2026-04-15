project = 'ETU Forms Documentation'
copyright = '2026, ETU'
author = 'RLS'

extensions = [
    'myst_parser',
]

templates_path = ['_templates']
exclude_patterns = []

language = 'ru'

html_theme = 'furo'
html_static_path = ['_static']

source_suffix = {
    '.md': 'markdown',
}

master_doc = 'index'