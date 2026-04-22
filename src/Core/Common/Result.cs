namespace osi.time.tracker.Core.Common;

public class Result
{
    protected Result(bool isSuccess, string error)
    {
        if ((isSuccess && error != string.Empty) || (!isSuccess && error == string.Empty))
            throw new InvalidOperationException();

        IsSuccess = isSuccess;
        Error = error;
    }

    public bool IsSuccess { get; }
    public bool IsFailure => !IsSuccess;
    public string Error { get; }

    public static Result Success()
    {
        return new Result(true, string.Empty);
    }

    public static Result Failure(string error)
    {
        return new Result(false, error);
    }
}

public class Result<T> : Result
{
    private Result(T? value, bool isSuccess, string error)
        : base(isSuccess, error)
    {
        Value = value;
    }

    public T Value => IsSuccess
        ? field!
        : throw new InvalidOperationException("The value of a failure result can not be accessed.");

    public static Result<T> Success(T value)
    {
        return new Result<T>(value, true, string.Empty);
    }

    public new static Result<T> Failure(string error)
    {
        return new Result<T>(default, false, error);
    }
}