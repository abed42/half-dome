#ifndef ARDIA_WIN_WEBUI_WEBUI_MODE_H_
#define ARDIA_WIN_WEBUI_WEBUI_MODE_H_

#include <string>

namespace base {
class CommandLine;
}

namespace ardia_win {

inline constexpr char kShellSwitch[] = "ardia-shell";
inline constexpr char kWebUIShell[] = "webui";
inline constexpr wchar_t kWebUIAppDataFolder[] = L"Ardia WebUI";
inline constexpr wchar_t kReactNativeAppDataFolder[] = L"Ardia";
inline constexpr wchar_t kWebUIChromiumFolder[] = L"Chromium";

bool WebUIShellRequested(const base::CommandLine& command_line);

std::wstring WebUIAppDataDirectory(const std::wstring& ardia_data_dir,
                                   const std::wstring& local_app_data);

std::wstring WebUIUserDataDirectory(const std::wstring& app_data_dir);

std::wstring ReactNativeAppDataDirectory(const std::wstring& local_app_data);

bool SamePath(const std::wstring& a, const std::wstring& b);

bool Inside(const std::wstring& path, const std::wstring& folder);

}

#endif
