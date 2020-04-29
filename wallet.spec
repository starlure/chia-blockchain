# -*- mode: python ; coding: utf-8 -*-

block_cipher = None


a = Analysis(['src/wallet/websocket_server.py'],
             pathex=['./venv/lib/python3.7/site-packages/aiter/', '/Users/yostra/chia/integration/chia-blockchain'],
             binaries=[],
             datas=[("./src/util/initial-config.yaml", "./src/util/"),
             ("./src/util/initial-plots.yaml", "./src/util/") ],
             hiddenimports=["aiter.active_aiter", "aiter.aiter_forker", "aiter.aiter_to_iter", "aiter.azip", "aiter.flatten_aiter", "aiter.gated_aiter",
    "aiter.iter_to_aiter", "aiter.join_aiters", "aiter.map_aiter", "aiter.map_filter_aiter", "aiter.preload_aiter",
    "aiter.push_aiter", "aiter.sharable_aiter", "aiter.stoppable_aiter"],
             hookspath=[],
             runtime_hooks=[],
             excludes=[],
             win_no_prefer_redirects=False,
             win_private_assemblies=False,
             cipher=block_cipher,
             noarchive=False)
pyz = PYZ(a.pure, a.zipped_data,
             cipher=block_cipher)
exe = EXE(pyz,
          a.scripts,
          [],
          exclude_binaries=True,
          name='websocket_server',
          debug=False,
          bootloader_ignore_signals=False,
          strip=False,
          upx=True,
          console=True )
coll = COLLECT(exe,
               a.binaries,
               a.zipfiles,
               a.datas,
               strip=False,
               upx=True,
               upx_exclude=[],
               name='websocket_server')
