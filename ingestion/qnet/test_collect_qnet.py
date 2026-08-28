import unittest
import zipfile

from collect_qnet import _decode_zip_name, parse_detail


class ParseDetailTest(unittest.TestCase):
    def test_extracts_attachment_and_kogl_license(self) -> None:
        content = """
        <p class="subject">2025년 제36회 공인중개사 시험문제지</p>
        <button onclick="fileDown('bbs/Q004/Q004_1', '문제지.zip', '1')">다운로드</button>
        <p>본 공공저작물은 공공누리 &quot;출처표시&quot; 조건에 따라 이용할 수 있습니다.</p>
        """

        title, files, license_name = parse_detail(content)

        self.assertEqual("2025년 제36회 공인중개사 시험문제지", title)
        self.assertEqual([("bbs/Q004/Q004_1", "문제지.zip")], files)
        self.assertEqual("KOGL_TYPE_1", license_name)

    def test_rejects_detail_without_attachment(self) -> None:
        with self.assertRaises(ValueError):
            parse_detail("<html></html>")

    def test_decodes_legacy_cp949_zip_name(self) -> None:
        expected = "시험문제지.pdf"
        member = zipfile.ZipInfo(expected.encode("cp949").decode("cp437"))

        self.assertEqual(expected, _decode_zip_name(member))


if __name__ == "__main__":
    unittest.main()