using osi.time.tracker.Core.Common;

namespace osi.time.tracker.Core.Services;

public class SampleService(TimeProvider timeProvider)
{
    public Result<string> GetCurrentTimeStatus()
    {
        var now = timeProvider.GetLocalNow();
        
        if (now.Hour < 0 || now.Hour > 23)
        {
            return Result<string>.Failure("Invalid hour detected.");
        }

        return Result<string>.Success($"The current time is {now:T}");
    }
}
