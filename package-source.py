"""Create a portable release archive without build state or recursive archives."""
import pathlib, sys, zipfile
root=pathlib.Path(__file__).resolve().parents[1]
out=pathlib.Path(sys.argv[1]).resolve()
out.parent.mkdir(parents=True,exist_ok=True)
with zipfile.ZipFile(out,'w',zipfile.ZIP_DEFLATED) as z:
 for path in sorted(root.rglob('*')):
  relative=path.relative_to(root)
  if path.is_file() and path.suffix!='.zip' and not set(relative.parts).intersection({'.git','.openai','.env','.env.local','node_modules','.atlas-cache'}):
   z.write(path,'VoyageXXVI/'+relative.as_posix())
with zipfile.ZipFile(out) as z:
 assert z.testzip() is None
 print(len(z.namelist()),'files verified')
