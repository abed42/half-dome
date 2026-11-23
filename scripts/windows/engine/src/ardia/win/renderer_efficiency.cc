#include "ardia/win/renderer_efficiency.h"

#include <windows.h>

#include <atomic>
#include <memory>
#include <optional>
#include <string>
#include <utility>

#include "ardia/win/hooks.h"
#include "base/containers/flat_map.h"
#include "base/functional/bind.h"
#include "base/memory/weak_ptr.h"
#include "base/no_destructor.h"
#include "base/process/process.h"
#include "base/synchronization/lock.h"
#include "base/task/sequenced_task_runner.h"
#include "base/time/time.h"
#include "base/win/win_util.h"
#include "base/win/windows_version.h"
#include "components/performance_manager/public/graph/frame_node.h"
#include "components/performance_manager/public/graph/graph.h"
#include "components/performance_manager/public/graph/graph_operations.h"
#include "components/performance_manager/public/graph/page_node.h"
#include "components/performance_manager/public/graph/process_node.h"
#include "components/performance_manager/public/performance_manager.h"
#include "components/performance_manager/public/priority/priority.h"
#include "components/performance_manager/public/priority/priority_voting_system.h"
#include "content/public/browser/render_frame_host.h"
#include "content/public/browser/render_process_host.h"
#include "content/public/browser/web_contents.h"

namespace ardia_win {

namespace {

using performance_manager::FrameNode;
using performance_manager::FrameNodeObserver;
using performance_manager::Graph;
using performance_manager::GraphOperations;
using performance_manager::PageNode;
using performance_manager::PageNodeObserver;
using performance_manager::PerformanceManager;
using performance_manager::ProcessNode;
using performance_manager::priority::PriorityVoter;
using performance_manager::priority::PriorityVotingSystem;
using performance_manager::priority::Vote;
using performance_manager::priority::VotingChannel;

constexpr char kKeepsCallOrPictureInPicture[] =
    "Ardia keeps calls and picture in picture at full speed.";
constexpr int kRestoreRetries = 3;
constexpr base::TimeDelta kRestoreRetryDelay = base::Seconds(1);

struct Counts {
  std::atomic<int> throttled{0};
  std::atomic<int> restored{0};
  std::atomic<int> failed{0};
  std::atomic<int> exempt_call{0};
  std::atomic<int> exempt_capture{0};
  std::atomic<int> exempt_picture_in_picture{0};
  std::atomic<int> exempt_audio{0};
};

Counts& CountsNow() {
  static Counts counts;
  return counts;
}

std::atomic<int> g_consent_generation{0};

int ConsentGeneration() {
  return g_consent_generation.load(std::memory_order_acquire);
}

void CountIn(int generation, std::atomic<int>& count) {
  if (generation == ConsentGeneration()) {
    ++count;
  }
}

int Take(std::atomic<int>& count) {
  return count.exchange(0, std::memory_order_relaxed);
}

std::optional<ULONG> MemoryPriorityOf(HANDLE process) {
  MEMORY_PRIORITY_INFORMATION memory = {};
  if (!::GetProcessInformation(process, ProcessMemoryPriority, &memory,
                               sizeof(memory))) {
    return std::nullopt;
  }
  return memory.MemoryPriority;
}

bool SetMemoryPriority(HANDLE process, ULONG priority) {
  MEMORY_PRIORITY_INFORMATION memory = {};
  memory.MemoryPriority = priority;
  return ::SetProcessInformation(process, ProcessMemoryPriority, &memory,
                                 sizeof(memory)) != 0;
}

bool TimerThrottleSupported() {
  return base::win::GetVersion() >= base::win::Version::WIN11_22H2;
}

std::optional<PROCESS_POWER_THROTTLING_STATE> PowerThrottlingOf(
    HANDLE process) {
  PROCESS_POWER_THROTTLING_STATE state = {};
  state.Version = PROCESS_POWER_THROTTLING_CURRENT_VERSION;
  if (!::GetProcessInformation(process, ProcessPowerThrottling, &state,
                               sizeof(state))) {
    return std::nullopt;
  }
  return state;
}

struct Lowered {
  base::ProcessId pid = base::kNullProcessId;
  bool efficient = false;
  std::optional<ULONG> memory_priority_when_shown;
  bool timer_throttled = false;
  int restore_attempts = 0;
  int restore_generation = 0;
};

class LauncherState {
 public:
  void OnPriority(const void* key,
                  const base::Process& process,
                  base::Process::Priority priority) {
    base::AutoLock hold(lock_);
    Lowered& lowered = by_helper_[key];
    if (lowered.pid != process.Pid()) {
      lowered = Lowered();
      lowered.pid = process.Pid();
    }
    const bool efficient = priority == base::Process::Priority::kBestEffort;
    if (efficient) {
      lowered.restore_attempts = 0;
      if (!lowered.efficient) {
        lowered.efficient = true;
        ++(Lower(process.Handle(), lowered) ? CountsNow().throttled
                                            : CountsNow().failed);
      }
      return;
    }
    if (!lowered.efficient && !Pending(lowered)) {
      return;
    }
    lowered.efficient = false;
    lowered.restore_attempts = 0;
    lowered.restore_generation = ConsentGeneration();
    RestoreOrRetry(key, process, lowered);
  }

  void OnClosed(const void* key) {
    base::AutoLock hold(lock_);
    by_helper_.erase(key);
  }

 private:
  static bool Pending(const Lowered& lowered) {
    return lowered.memory_priority_when_shown.has_value() ||
           lowered.timer_throttled;
  }

  static bool Lower(HANDLE process, Lowered& lowered) {
    bool done = true;
    if (!lowered.memory_priority_when_shown) {
      std::optional<ULONG> shown = MemoryPriorityOf(process);
      if (shown && SetMemoryPriority(process, MEMORY_PRIORITY_VERY_LOW)) {
        lowered.memory_priority_when_shown = *shown;
      } else {
        done = false;
      }
    }
    if (TimerThrottleSupported() && !lowered.timer_throttled) {
      if (base::win::SetProcessTimerThrottleState(
              process, base::win::ProcessPowerState::kEnabled)) {
        lowered.timer_throttled = true;
      } else {
        done = false;
      }
    }
    return done;
  }

  static bool Restore(HANDLE process, Lowered& lowered) {
    if (lowered.memory_priority_when_shown &&
        SetMemoryPriority(process, *lowered.memory_priority_when_shown)) {
      lowered.memory_priority_when_shown.reset();
    }
    if (lowered.timer_throttled &&
        base::win::SetProcessTimerThrottleState(
            process, base::win::ProcessPowerState::kUnset)) {
      lowered.timer_throttled = false;
    }
    return !Pending(lowered);
  }

  void RestoreOrRetry(const void* key,
                      const base::Process& process,
                      Lowered& lowered) {
    if (Restore(process.Handle(), lowered)) {
      CountIn(lowered.restore_generation, CountsNow().restored);
      return;
    }
    if (++lowered.restore_attempts > kRestoreRetries) {
      CountIn(lowered.restore_generation, CountsNow().failed);
      return;
    }
    base::Process copy = process.Duplicate();
    if (!copy.IsValid()) {
      CountIn(lowered.restore_generation, CountsNow().failed);
      return;
    }
    base::SequencedTaskRunner::GetCurrentDefault()->PostDelayedTask(
        FROM_HERE,
        base::BindOnce(&LauncherState::Retry, base::Unretained(this), key,
                       std::move(copy)),
        kRestoreRetryDelay);
  }

  void Retry(const void* key, base::Process process) {
    base::AutoLock hold(lock_);
    auto found = by_helper_.find(key);
    if (found == by_helper_.end() || found->second.pid != process.Pid() ||
        found->second.efficient || !Pending(found->second)) {
      return;
    }
    RestoreOrRetry(key, process, found->second);
  }

  base::Lock lock_;
  base::flat_map<const void*, Lowered> by_helper_;
};

LauncherState& Launcher() {
  static base::NoDestructor<LauncherState> state;
  return *state;
}

void OnRendererPriority(const void* key,
                        const base::Process& process,
                        base::Process::Priority priority) {
  if (process.IsValid()) {
    Launcher().OnPriority(key, process, priority);
  }
}

void OnRendererClosed(const void* key) {
  Launcher().OnClosed(key);
}

class KeepCallsAndPictureInPicture : public PriorityVoter,
                                     public FrameNodeObserver,
                                     public PageNodeObserver {
 public:
  KeepCallsAndPictureInPicture() = default;
  KeepCallsAndPictureInPicture(const KeepCallsAndPictureInPicture&) = delete;
  KeepCallsAndPictureInPicture& operator=(const KeepCallsAndPictureInPicture&) =
      delete;
  ~KeepCallsAndPictureInPicture() override = default;

  void InitializeOnGraph(Graph* graph, VotingChannel voting_channel) override {
    voting_channel_ = std::move(voting_channel);
    graph->AddFrameNodeObserver(this);
    graph->AddPageNodeObserver(this);
    for (const FrameNode* frame_node : graph->GetAllFrameNodes()) {
      SetVoteForFrame(frame_node, frame_node->GetPageNode());
    }
  }

  void TearDownOnGraph(Graph* graph) override {
    graph->RemovePageNodeObserver(this);
    graph->RemoveFrameNodeObserver(this);
    voting_channel_.Reset();
  }

  void OnBeforeFrameNodeAdded(
      const FrameNode* frame_node,
      const FrameNode* pending_parent_frame_node,
      const PageNode* pending_page_node,
      const ProcessNode* pending_process_node,
      const FrameNode* pending_parent_or_outer_document_or_embedder) override {
    SetVoteForFrame(frame_node, pending_page_node);
  }

  void OnBeforeFrameNodeRemoved(const FrameNode* frame_node) override {
    voting_channel_.SetVote(frame_node, std::nullopt);
  }

  void OnFrameUsesWebRTCChanged(const FrameNode* frame_node) override {
    SetVoteForFrame(frame_node, frame_node->GetPageNode());
  }

  void OnPageUsesWebRTCChanged(const PageNode* page_node) override {
    SetVotesForPage(page_node);
  }

  void OnHasPictureInPictureChanged(const PageNode* page_node) override {
    SetVotesForPage(page_node);
  }

 private:
  void SetVotesForPage(const PageNode* page_node) {
    GraphOperations::VisitFrameTreePreOrder(
        page_node, [this, page_node](const FrameNode* frame_node) {
          SetVoteForFrame(frame_node, page_node);
          return true;
        });
  }

  void SetVoteForFrame(const FrameNode* frame_node, const PageNode* page_node) {
    const bool keep = frame_node->UsesWebRTC() ||
                      (page_node && (page_node->UsesWebRTC() ||
                                     page_node->HasPictureInPicture()));
    voting_channel_.SetVote(
        frame_node, Vote(keep ? base::Process::Priority::kUserBlocking
                              : base::Process::Priority::kMinValue,
                         kKeepsCallOrPictureInPicture));
  }

  VotingChannel voting_channel_;
};

bool CapturingInPage(const PageNode* page_node) {
  bool capturing = false;
  GraphOperations::VisitFrameTreePreOrder(
      page_node, [&capturing](const FrameNode* frame_node) {
        capturing = frame_node->IsCapturingMediaStream();
        return !capturing;
      });
  return capturing;
}

const char* PriorityName(base::Process::Priority priority) {
  switch (priority) {
    case base::Process::Priority::kBestEffort:
      return "bestEffort";
    case base::Process::Priority::kUserVisible:
      return "userVisible";
    case base::Process::Priority::kUserBlocking:
      return "userBlocking";
  }
  return "unknown";
}

bool g_started = false;

}

void StartRendererEfficiency() {
  if (g_started || !PerformanceManager::IsAvailable()) {
    return;
  }
  g_started = true;
  g_ardia_win_renderer_priority = &OnRendererPriority;
  g_ardia_win_renderer_closed = &OnRendererClosed;
  Graph* graph = PerformanceManager::GetGraph();
  if (auto* voting = graph->GetRegisteredObjectAs<PriorityVotingSystem>()) {
    voting->AddPriorityVoter<KeepCallsAndPictureInPicture>();
  }
}

void NoteTabHiddenForEfficiency(content::WebContents* contents) {
  if (!contents || !PerformanceManager::IsAvailable()) {
    return;
  }
  base::WeakPtr<PageNode> page =
      PerformanceManager::GetPrimaryPageNodeForWebContents(contents);
  if (!page) {
    return;
  }
  Counts& counts = CountsNow();
  if (page->UsesWebRTC()) {
    ++counts.exempt_call;
  } else if (contents->IsBeingCaptured() || CapturingInPage(page.get())) {
    ++counts.exempt_capture;
  } else if (page->HasPictureInPicture()) {
    ++counts.exempt_picture_in_picture;
  } else if (page->IsAudible()) {
    ++counts.exempt_audio;
  }
}

base::DictValue TakeRendererEfficiencyCounts(const std::string& epoch) {
  static base::NoDestructor<std::string> counted_for;
  Counts& counts = CountsNow();
  if (epoch != *counted_for) {
    *counted_for = epoch;
    g_consent_generation.fetch_add(1, std::memory_order_acq_rel);
    for (std::atomic<int>* count :
         {&counts.throttled, &counts.restored, &counts.failed,
          &counts.exempt_call, &counts.exempt_capture,
          &counts.exempt_picture_in_picture, &counts.exempt_audio}) {
      Take(*count);
    }
  }
  base::DictValue result;
  result.Set("throttled", Take(counts.throttled));
  result.Set("restored", Take(counts.restored));
  result.Set("failed", Take(counts.failed));
  result.Set("exemptCall", Take(counts.exempt_call));
  result.Set("exemptCapture", Take(counts.exempt_capture));
  result.Set("exemptPictureInPicture", Take(counts.exempt_picture_in_picture));
  result.Set("exemptAudio", Take(counts.exempt_audio));
  return result;
}

base::DictValue RendererEfficiencyOf(content::WebContents* contents) {
  base::DictValue result;
  if (!contents || !PerformanceManager::IsAvailable()) {
    return result;
  }
  content::RenderProcessHost* host =
      contents->GetPrimaryMainFrame()->GetProcess();
  base::WeakPtr<ProcessNode> node =
      PerformanceManager::GetProcessNodeForRenderProcessHost(host);
  if (!node || !node->GetProcess().IsValid()) {
    return result;
  }
  HANDLE process = node->GetProcess().Handle();
  result.Set("pid", static_cast<int>(node->GetProcess().Pid()));
  result.Set("votedPriority", PriorityName(node->GetPriority()));
  result.Set("appliedPriority", PriorityName(host->GetPriority()));
  result.Set("priorityClass", static_cast<int>(::GetPriorityClass(process)));
  if (std::optional<ULONG> memory = MemoryPriorityOf(process)) {
    result.Set("memoryPriority", static_cast<int>(*memory));
  }
  if (std::optional<PROCESS_POWER_THROTTLING_STATE> power =
          PowerThrottlingOf(process)) {
    result.Set("powerControlMask", static_cast<int>(power->ControlMask));
    result.Set("powerStateMask", static_cast<int>(power->StateMask));
  }
  return result;
}

}
