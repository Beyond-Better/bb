class Bb < Formula

  desc "Beyond Better at ... Everything You Do with Text"
  version "0.0.3-alpha"
  url "https://github.com/Beyond-Better/bb/archive/v0.0.3-alpha.tar.gz"
  sha256 "df50cc136db0c25631d4e779940031135c59468455ba0ac79e14e40b6fd22be3"
  homepage "https://github.com/Beyond-Better/bb"
  license "MIT"
  head "https://github.com/Beyond-Better/bb.git", branch: "main"

  depends_on "deno"
  depends_on "git"
  depends_on "universal-ctags" => :recommended

  def install
    system "deno", "task", "build"
    bin.install "build/bb"
    bin.install "build/bb-api"
  end

  test do
    assert_match "BB CLI", shell_output("#{bin}/bb --help")
    assert_match "BB API", shell_output("#{bin}/bb-api --help")
  end
end
