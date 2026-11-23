#include "ardia/win/webui/webui_mode.h"

#include <cwctype>

#include "base/command_line.h"

namespace ardia_win {

namespace {

std::wstring Trimmed(std::wstring path) {
  while (!path.empty() && (path.back() == L'\\' || path.back() == L'/')) {
    path.pop_back();
  }
  return path;
}

std::wstring Normalized(const std::wstring& path) {
  std::wstring out = Trimmed(path);
  for (wchar_t& c : out) {
    c = c == L'/' ? L'\\' : static_cast<wchar_t>(std::towlower(c));
  }
  return out;
}

}

bool WebUIShellRequested(const base::CommandLine& command_line) {
  return command_line.GetSwitchValueASCII(kShellSwitch) == kWebUIShell;
}

std::wstring WebUIAppDataDirectory(const std::wstring& ardia_data_dir,
                                   const std::wstring& local_app_data) {
  const std::wstring scratch = Trimmed(ardia_data_dir);
  if (!scratch.empty()) {
    return scratch;
  }
  const std::wstring local = Trimmed(local_app_data);
  if (local.empty()) {
    return std::wstring();
  }
  return local + L"\\" + kWebUIAppDataFolder;
}

std::wstring WebUIUserDataDirectory(const std::wstring& app_data_dir) {
  if (app_data_dir.empty()) {
    return std::wstring();
  }
  return Trimmed(app_data_dir) + L"\\" + kWebUIChromiumFolder;
}

std::wstring ReactNativeAppDataDirectory(const std::wstring& local_app_data) {
  const std::wstring local = Trimmed(local_app_data);
  return local.empty() ? std::wstring()
                       : local + L"\\" + kReactNativeAppDataFolder;
}

bool SamePath(const std::wstring& a, const std::wstring& b) {
  return !a.empty() && Normalized(a) == Normalized(b);
}

bool Inside(const std::wstring& path, const std::wstring& folder) {
  const std::wstring parent = Normalized(folder);
  const std::wstring child = Normalized(path);
  return !parent.empty() && child.size() > parent.size() &&
         child.compare(0, parent.size(), parent) == 0 &&
         child[parent.size()] == L'\\';
}

}
