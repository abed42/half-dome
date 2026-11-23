#ifndef ARDIA_WIN_RENDERER_EFFICIENCY_H_
#define ARDIA_WIN_RENDERER_EFFICIENCY_H_

#include <string>

#include "base/values.h"

namespace content {
class WebContents;
}

namespace ardia_win {

void StartRendererEfficiency();
void NoteTabHiddenForEfficiency(content::WebContents* contents);
base::DictValue TakeRendererEfficiencyCounts(const std::string& epoch);
base::DictValue RendererEfficiencyOf(content::WebContents* contents);

}

#endif
