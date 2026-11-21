import unittest

from scripts.sync_marketing_data import parse_instagram_follower_count


class InstagramFollowerCountTests(unittest.TestCase):
    def test_reads_exact_count_from_embedded_profile_data(self):
        page = '<script>{"edge_followed_by":{"count":882}}</script>'

        self.assertEqual(parse_instagram_follower_count(page), 882)

    def test_parses_meta_description_with_attributes_in_either_order(self):
        page = (
            '<meta content="9,229 Followers, 403 Following" '
            'name="description">'
        )

        self.assertEqual(parse_instagram_follower_count(page), 9229)

    def test_expands_instagram_abbreviated_counts(self):
        page = '<meta property="og:description" content="10.1K Followers">'

        self.assertEqual(parse_instagram_follower_count(page), 10100)

    def test_returns_none_when_profile_has_no_follower_count(self):
        self.assertIsNone(parse_instagram_follower_count("<html></html>"))


if __name__ == "__main__":
    unittest.main()
