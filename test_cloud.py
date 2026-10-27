import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch, Mock
from beebright_local import cloud, engine, studio
from beebright_local.app import DesktopApi


class CloudTests(unittest.TestCase):
    def setUp(self):
        self.temp=tempfile.TemporaryDirectory()
        self.patch=patch.object(engine,'USER_DATA',Path(self.temp.name));self.patch.start()
        self.worker=patch.object(cloud,'_worker_started',True);self.worker.start()
        self.remote=patch.object(cloud,'remote');self.remote_mock=self.remote.start()
        self.account={'user_id':'user_test','token':'bb_test','mode':'cloud'}

    def tearDown(self):
        self.remote.stop();self.worker.stop();self.patch.stop();self.temp.cleanup()

    def test_local_mode_never_uploads_and_account_cache_is_separate(self):
        api=DesktopApi()
        local={'words':[{'word':'bee'}],'index':0}
        api.request('/api/progress','PUT',{'session':local})
        self.remote_mock.assert_not_called()
        cloud.save_config(self.account)
        remote={'words':[{'word':'sky'}],'index':0}
        api.request('/api/progress','PUT',{'session':remote})
        self.assertEqual(studio.read('progress.json'),local)
        cloud.request('/api/account/mode','PUT',{'mode':'local'})
        self.assertEqual(api.request('/api/progress')['session'],local)
        self.remote_mock.assert_not_called()
        with self.assertRaises(ValueError): cloud.request('/api/activity','PUT',{'screen':'practice'})

    def test_cloud_saves_queue_durably_and_retry_without_losing_data(self):
        cloud.save_config(self.account)
        session={'words':[{'word':'bee'}],'index':2}
        cloud.request('/api/progress','PUT',{'session':session})
        self.assertTrue(engine.read_json(cloud.cache_name(self.account,'pending'))['progress'])
        self.remote_mock.side_effect=ValueError('offline')
        with self.assertRaises(ValueError): cloud.flush(cloud.config())
        self.assertEqual(cloud.request('/api/progress')['session'],session)
        self.remote_mock.side_effect=None
        cloud.flush(cloud.config())
        self.assertEqual(engine.read_json(cloud.cache_name(self.account,'pending')),{})
        self.remote_mock.assert_called_with('/api/progress','PUT',{'session':session},'bb_test')

    def test_import_is_explicit_and_leaves_local_progress_untouched(self):
        local={'words':[{'word':'bee'}],'index':4}
        studio.save('progress.json',local)
        studio.save('studio.json',{'events':[],'favorites':['bee']})
        cloud.save_config({**self.account,'mode':'local'})
        self.remote_mock.return_value={'events':[],'favorites':['bee']}
        cloud.request('/api/account/sync','PUT')
        self.assertEqual(studio.read('progress.json'),local)
        self.assertEqual(cloud.status()['mode'],'local')
        self.remote_mock.assert_any_call('/api/progress','PUT',{'session':local},'bb_test')
        self.assertEqual(cloud.request('/api/account/status')['mode'],'local')

    def test_accounts_and_backups_do_not_leak_credentials_or_caches(self):
        cloud.save_config(self.account)
        a=cloud.cache_name(self.account,'progress')
        b=cloud.cache_name({**self.account,'user_id':'user_other'},'progress')
        self.assertNotEqual(a,b)
        self.assertNotIn('bb_test',str(studio.backup()))
        self.assertNotIn('token',cloud.status())
        self.assertNotIn('token',DesktopApi().request('/api/account/status'))

    def test_logout_cancels_login_and_stays_local_even_without_network(self):
        cloud.save_config(self.account)
        self.remote_mock.side_effect=ValueError('offline')
        cloud.request('/api/account/logout','PUT')
        self.assertFalse(cloud.status()['signed_in'])
        self.assertEqual(cloud.status()['mode'],'local')
        with self.assertRaises(ValueError): cloud.request('/api/account/mode','PUT',{'mode':'cloud'})

    def test_login_defaults_to_cloud_only_after_approval(self):
        self.remote_mock.side_effect=[{'token':'bb_new','code':'ABCDEFGH','url':'https://www.beebright.app/classrooms?connect=ABCDEFGH'},{'user_id':'user_new'}]
        captured=[]
        with patch.object(cloud.threading,'Thread') as thread,patch.object(cloud.webbrowser,'open') as browser,patch.object(cloud.time,'sleep'):
            thread.side_effect=lambda target,daemon:Mock(start=lambda:captured.append(target))
            initial=cloud.login()
            self.assertEqual(initial['mode'],'local')
            self.assertTrue(initial['pending'])
            browser.assert_called_once()
            captured[0]()
        self.assertEqual(cloud.status()['mode'],'cloud')
        self.assertEqual(cloud.status()['user_id'],'user_new')
