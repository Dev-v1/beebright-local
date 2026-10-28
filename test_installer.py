"""Run the real shell installer with isolated home directories and fake downloads."""
import os
import shlex
import shutil
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parent


@unittest.skipIf(os.name == 'nt', 'POSIX shell installer; checked on macOS and Linux')
class InstallerTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory(prefix="bee install ' ")
        self.root = Path(self.temp.name)
        self.home = self.root / "home with spaces"
        self.bin = self.root / "commands"
        self.home.mkdir()
        self.bin.mkdir()
        self.env = {**os.environ, 'HOME': str(self.home), 'PATH': str(self.bin)+os.pathsep+os.environ['PATH'],
                    'SHELL': '/bin/bash', 'BEE_TEST_PYTHON': str(self.bin/'python-test')}
        self.env.pop('ZDOTDIR', None)
        self.script('uname', "#!/bin/sh\nprintf 'Darwin\\n'\n")
        self.script('python-test', "#!/bin/sh\nif [ \"$1\" = '-c' ]; then exit 0; fi\nexec "+shlex.quote(sys.executable)+" \"$@\"\n")
        self.script('curl', '#!'+sys.executable+'\n'+
            "import os,sys\nfrom pathlib import Path\n"
            "target=Path(sys.argv[sys.argv.index('-o')+1])\n"
            "if 'https://astral.sh/uv/install.sh' in sys.argv:\n"
            " target.write_text('#!/bin/sh\\nexit 0\\n')\n"
            " uv=Path(os.environ['UV_UNMANAGED_INSTALL'])/'uv'\n"
            " uv.write_text('#!/bin/sh\\nif [ \"$2\" = find ]; then printf \\'%s\\\\n\\' \"$BEE_TEST_PYTHON\"; fi\\n')\n"
            " uv.chmod(0o755)\n"
            "else:\n"
            " target.write_text('print(\"BeeBright installer test\")\\n')\n")

    def tearDown(self):
        self.temp.cleanup()

    def script(self, name, text):
        p = self.bin/name
        p.write_text(text)
        p.chmod(0o755)

    def install(self):
        return subprocess.run(['/bin/sh', str(ROOT/'install.sh')], env=self.env,
                              text=True, capture_output=True, check=True, timeout=20).stdout

    def test_bash_login_profile_command_and_repeat_install(self):
        profile = self.home/'.bash_profile'
        profile.write_text('# my settings\n')
        output = self.install()
        self.install()
        for p in [profile, self.home/'.bashrc', self.home/'.zprofile', self.home/'.zshrc']:
            self.assertEqual(p.read_text().count('# BeeBright'), 1)
        self.assertTrue(profile.read_text().startswith('# my settings\n'))
        self.assertIn('export PATH="$HOME/.local/bin:$PATH"', output)
        bash = shutil.which('bash')
        result = subprocess.run([bash, '--noprofile', '--norc', '-c',
                                 '. "$HOME/.bash_profile"; command -v beebright; beebright --version'],
                                env=self.env, text=True, capture_output=True, check=True)
        self.assertIn(str(self.home/'.local/bin/beebright'), result.stdout)
        self.assertIn('BeeBright installer test', result.stdout)

    def test_existing_bash_login_is_respected(self):
        (self.home/'.bash_login').write_text('# existing login\n')
        self.install()
        self.assertFalse((self.home/'.bash_profile').exists())
        self.assertIn('# BeeBright', (self.home/'.bash_login').read_text())

    def test_default_profile_and_custom_zsh_directory(self):
        self.env['ZDOTDIR'] = str(self.home/'custom zsh')
        self.env['SHELL'] = '/bin/zsh'
        self.install()
        self.assertIn('# BeeBright', (self.home/'.profile').read_text())
        for name in ['.zprofile', '.zshrc']:
            self.assertIn('# BeeBright', (Path(self.env['ZDOTDIR'])/name).read_text())
        zsh = shutil.which('zsh')
        if sys.platform == 'darwin':
            self.assertIsNotNone(zsh, 'macOS regression must exercise zsh')
        if zsh:
            result = subprocess.run([zsh, '-lic', 'command -v beebright; beebright --version'],
                                    env=self.env, text=True, capture_output=True, check=True)
            self.assertIn(str(self.home/'.local/bin/beebright'), result.stdout)
            self.assertIn('BeeBright installer test', result.stdout)
